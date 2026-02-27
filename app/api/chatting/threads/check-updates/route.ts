import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserSubcollectionRefFromResolved } from "@/lib/firebase";
import { fetchThreadMessages } from "@/lib/gmail";
import { handleError } from "@/lib/errors/handler";

export const dynamic = 'force-dynamic';

/**
 * Check if there are new messages in any thread
 * Returns list of emailIds that have new messages
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const { ref: userRef } = await resolveUserDocument(userId);
    const repliesCollection = getUserSubcollectionRefFromResolved(userRef, "REPLIES");

    // Get all unique emailIds from replies
    const repliesSnapshot = await repliesCollection.get();
    const emailIdSet = new Set<string>();
    const emailIdToThreadId = new Map<string, string | null>();
    
    repliesSnapshot.docs.forEach((doc) => {
      const reply = doc.data();
      const emailId = reply.emailId;
      if (emailId) {
        emailIdSet.add(emailId);
        if (!emailIdToThreadId.has(emailId)) {
          emailIdToThreadId.set(emailId, reply.threadId || null);
        }
      }
    });

    const emailIdsWithNewMessages: string[] = [];
    const userEmail = user.email || "";

    // Check each thread for new messages (in parallel batches)
    const emailIds = Array.from(emailIdSet);
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < emailIds.length; i += BATCH_SIZE) {
      const batchEmailIds = emailIds.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batchEmailIds.map(async (emailId) => {
        const threadId = emailIdToThreadId.get(emailId);
        if (!threadId) return;

        try {
          // Get existing message IDs from Firebase
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

          // Fetch messages from Gmail
          const threadMessages = await fetchThreadMessages(userId, threadId);
          
          // Check if there are any new messages
          const hasNewMessages = threadMessages.some(msg => !existingExternalIds.has(msg.id));
          
          if (hasNewMessages) {
            emailIdsWithNewMessages.push(emailId);
          }
        } catch (error) {
          console.error(`[Check Updates] Error checking thread ${emailId}:`, error);
          // Continue checking other threads
        }
      }));
    }

    return NextResponse.json({
      success: true,
      hasUpdates: emailIdsWithNewMessages.length > 0,
      emailIdsWithNewMessages,
      totalThreads: emailIds.length,
    });
  } catch (error: any) {
    console.error("[Check Updates] Error:", error);
    return handleError(error);
  }
}

