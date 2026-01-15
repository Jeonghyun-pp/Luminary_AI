import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserEmailCollectionRefFromResolved, getUserSubcollectionRefFromResolved } from "@/lib/firebase";
import { sendGmailReply, markThreadAsRead } from "@/lib/gmail";
import { FieldValue } from "firebase-admin/firestore";

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

