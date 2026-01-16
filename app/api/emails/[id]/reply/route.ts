import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserEmailCollectionRefFromResolved, getUserSubcollectionRefFromResolved } from "@/lib/firebase";
import { sendGmailReply, markThreadAsRead } from "@/lib/gmail";
import { FieldValue } from "firebase-admin/firestore";
import { openai } from "@/lib/openai";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const emailId = params.id;
    const body = await request.json();
    const { subject, body: replyBody } = body;

    if (!subject || !replyBody) {
      return NextResponse.json(
        { error: "Subject and body are required" },
        { status: 400 }
      );
    }

    const { ref: userRef } = await resolveUserDocument(userId);
    const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);

    const emailDoc = await inboxCollection.doc(emailId).get();

    if (!emailDoc.exists) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    const email = emailDoc.data();
    if (!email) {
      return NextResponse.json({ error: "Email data not found" }, { status: 404 });
    }
    const recipientEmail = email.from.includes("<") 
      ? email.from.split("<")[1].split(">")[0] 
      : email.from;

    // Send reply via Gmail API
    const replyResult = await sendGmailReply(
      userId,
      email.externalId,
      subject,
      replyBody,
      recipientEmail
    );

    // Save reply to replies subcollection
    const repliesCollection = getUserSubcollectionRefFromResolved(userRef, "REPLIES");
    
    // First, save the original email to replies collection if not already there
    const existingOriginalCheck = await repliesCollection
      .where("emailId", "==", emailId)
      .where("externalMessageId", "==", email.externalId)
      .limit(1)
      .get();
    
    if (existingOriginalCheck.empty) {
      // Save original email to replies collection
      await repliesCollection.add({
        emailId: emailId,
        externalMessageId: email.externalId, // Original email's Gmail message ID
        threadId: email.threadId || null,
        subject: email.subject || "",
        body: email.bodyFullText || email.bodySnippet || "",
        from: email.from || "",
        to: user.email || "",
        sentAt: email.receivedAt?.toDate?.() || new Date(email.receivedAt || Date.now()),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    
    // Save reply
    await repliesCollection.add({
      emailId: emailId,
      externalMessageId: replyResult.messageId, // Gmail message ID
      threadId: email.threadId || null,
      subject: subject,
      body: replyBody,
      to: recipientEmail,
      from: user.email || "",
      sentAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Mark thread as read immediately after sending (so it doesn't show as unread)
    if (email.threadId) {
      try {
        await markThreadAsRead(userId, email.threadId);
        console.log(`[Reply Email] Marked thread ${email.threadId} as read after sending reply`);
      } catch (error: any) {
        console.error(`[Reply Email] Failed to mark thread as read:`, error);
        // Don't fail the request if marking as read fails
      }
    }

    // Generate and save subject summary if not already exists
    if (!email.subjectSummary && email.subject) {
      try {
        const titleResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { 
              role: "system", 
              content: "You are a title summarization assistant. Summarize the given email subject into a concise, clear summary. Maximum 50 characters in Korean. Remove unnecessary words like 'Re:', 'Fwd:', etc. Keep only the essential information." 
            },
            { 
              role: "user", 
              content: `Summarize this email subject into a concise summary:\n\n${email.subject}` 
            },
          ],
          temperature: 0.3,
          max_tokens: 50,
        });
        
        const summarized = titleResponse.choices[0].message.content?.trim();
        if (summarized) {
          // Update email document with subject summary
          await inboxCollection.doc(emailId).update({
            subjectSummary: summarized,
            updatedAt: FieldValue.serverTimestamp(),
          });
          console.log(`[Reply Email] Saved subject summary for email ${emailId}: ${summarized}`);
        }
      } catch (error: any) {
        console.error(`[Reply Email] Failed to generate subject summary:`, error);
        // Don't fail the request if summarization fails
      }
    }

    return NextResponse.json({
      success: true,
      messageId: replyResult.messageId,
    });
  } catch (error: any) {
    console.error("[Reply Email] Error:", error);
    
    // Check if it's an insufficient permission error
    if (error.code === 403 && error.message?.includes("Insufficient Permission")) {
      return NextResponse.json(
        { 
          error: "Gmail 전송 권한이 없습니다. 로그아웃 후 다시 로그인해주세요.",
          code: "INSUFFICIENT_PERMISSION",
          requiresReauth: true
        },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to send reply" },
      { status: 500 }
    );
  }
}

