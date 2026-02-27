import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserSubcollectionRefFromResolved, getUserEmailCollectionRefFromResolved } from "@/lib/firebase";
import { fetchThreadMessages } from "@/lib/gmail";
import { FieldValue } from "firebase-admin/firestore";
import { handleError } from "@/lib/errors/handler";

export const dynamic = 'force-dynamic';

/**
 * Sync messages from Gmail thread to Firebase replies collection
 * This will fetch all messages in the thread and save them to Firebase
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { emailId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const emailId = params.emailId;

    const { ref: userRef } = await resolveUserDocument(userId);
    const repliesCollection = getUserSubcollectionRefFromResolved(userRef, "REPLIES");
    const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);

    // Get original email to get threadId (if exists)
    const emailDoc = await inboxCollection.doc(emailId).get();
    const email = emailDoc.exists ? emailDoc.data() : null;
    
    // Try to get threadId from email or from replies
    let threadId: string | null = null;
    
    if (email) {
      threadId = email.threadId || null;
    }
    
    // If no threadId from email, try to get from replies
    if (!threadId) {
      const repliesCheck = await repliesCollection
        .where("emailId", "==", emailId)
        .limit(1)
        .get();
      
      if (!repliesCheck.empty) {
        threadId = repliesCheck.docs[0].data().threadId || null;
      }
    }

    if (!threadId) {
      return NextResponse.json({ error: "No thread ID found" }, { status: 400 });
    }

    // Fetch all messages from Gmail thread
    const threadMessages = await fetchThreadMessages(user.id, threadId);
    const userEmail = user.email || "";

    // Get all existing replies for this thread to avoid duplicates
    // Check by threadId to catch all messages in the thread, not just this emailId
    const existingRepliesSnapshot = await repliesCollection
      .where("threadId", "==", threadId)
      .get();
    
    const existingExternalIds = new Set(
      existingRepliesSnapshot.docs
        .map(doc => {
          const data = doc.data();
          return data.externalMessageId || null;
        })
        .filter(id => id !== null && id !== undefined)
    );

    let syncedCount = 0;

    // Save all messages (both sent and received) to Firebase (including original email)
    for (const msg of threadMessages) {
      // Skip if already exists (check by externalMessageId)
      if (existingExternalIds.has(msg.id)) {
        continue;
      }

      // Double-check: query directly by externalMessageId to avoid race conditions
      const duplicateCheck = await repliesCollection
        .where("externalMessageId", "==", msg.id)
        .limit(1)
        .get();
      
      if (!duplicateCheck.empty) {
        continue; // Already exists, skip
      }

      // Determine recipient email
      const recipientEmail = msg.isSent 
        ? (msg.to.includes("<") ? msg.to.split("<")[1].split(">")[0] : msg.to)
        : userEmail;

      // Save to Firebase
      await repliesCollection.add({
        emailId: emailId,
        externalMessageId: msg.id,
        threadId: threadId,
        subject: msg.subject || "",
        body: msg.body || "",
        from: msg.from || userEmail,
        to: recipientEmail,
        sentAt: msg.sentAt, // Use actual sent time from Gmail
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      syncedCount++;
    }

    return NextResponse.json({
      success: true,
      syncedCount,
      totalMessages: threadMessages.length,
    });
  } catch (error: any) {
    console.error("[Sync Thread] Error:", error);
    return handleError(error);
  }
}

