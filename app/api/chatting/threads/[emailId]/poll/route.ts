import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserSubcollectionRefFromResolved, getUserEmailCollectionRefFromResolved } from "@/lib/firebase";
import { fetchThreadMessages } from "@/lib/gmail";
import { FieldValue } from "firebase-admin/firestore";
import { handleError } from "@/lib/errors/handler";

export const dynamic = 'force-dynamic';

/**
 * Background polling endpoint to sync Gmail messages to Firebase
 * This should be called every 5 seconds from the client
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
    const threadMessages = await fetchThreadMessages(userId, threadId);
    const userEmail = user.email || "";

    // Get all existing replies for this emailId to avoid duplicates
    // Use emailId for faster query (more specific than threadId)
    const existingRepliesSnapshot = await repliesCollection
      .where("emailId", "==", emailId)
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
    const newMessages: any[] = [];

    // Collect new messages first (avoid individual queries)
    for (const msg of threadMessages) {
      // Skip if already exists
      if (existingExternalIds.has(msg.id)) {
        continue;
      }

      // Determine recipient email
      const recipientEmail = msg.isSent 
        ? (msg.to.includes("<") ? msg.to.split("<")[1].split(">")[0] : msg.to)
        : userEmail;

      newMessages.push({
        emailId: emailId,
        externalMessageId: msg.id,
        threadId: threadId,
        subject: msg.subject || "",
        body: msg.body || "",
        from: msg.from || userEmail,
        to: recipientEmail,
        sentAt: msg.sentAt,
      });
    }

    // Batch write all new messages at once (more efficient)
    // Firestore batch limit is 500 operations
    const batchSize = 500;
    for (let i = 0; i < newMessages.length; i += batchSize) {
      const batchMessages = newMessages.slice(i, i + batchSize);
      const batch = repliesCollection.firestore.batch();
      
      for (const msg of batchMessages) {
        const docRef = repliesCollection.doc();
        batch.set(docRef, {
          ...msg,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      
      await batch.commit();
      syncedCount += batchMessages.length;
    }

    return NextResponse.json({
      success: true,
      syncedCount,
      totalMessages: threadMessages.length,
    });
  } catch (error: any) {
    console.error("[Poll Thread] Error:", error);
    return handleError(error);
  }
}

