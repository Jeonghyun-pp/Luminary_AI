import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserSubcollectionRefFromResolved, getUserEmailCollectionRefFromResolved, getUserTaskCollectionRefFromResolved } from "@/lib/firebase";
import { getThreadUnreadCount } from "@/lib/gmail";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const { ref: userRef } = await resolveUserDocument(userId);
    const repliesCollection = getUserSubcollectionRefFromResolved(userRef, "REPLIES");
    const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);

    // Get all tasks to check which emails have tasks
    const tasksCollection = getUserTaskCollectionRefFromResolved(userRef);
    const tasksSnapshot = await tasksCollection.get();
    const emailIdsWithTasks = new Set<string>();
    tasksSnapshot.docs.forEach((doc) => {
      const task = doc.data();
      if (task.emailId) {
        emailIdsWithTasks.add(task.emailId);
      }
    });

    // Get all replies (without orderBy to avoid index requirement, will sort in memory)
    const repliesSnapshot = await repliesCollection.get();

    // Group replies by emailId (thread)
    const threadMap = new Map<string, {
      emailId: string;
      threadId: string | null;
      subject: string;
      subjectSummary?: string; // 제목 요약
      from: string;
      fromEmail: string;
      lastMessageAt: Date;
      unreadCount: number;
      hasTask: boolean;
      hasReplied?: boolean; // 원클릭 회신 여부
    }>();

    for (const replyDoc of repliesSnapshot.docs) {
      const reply = replyDoc.data();
      const emailId = reply.emailId;

      if (!threadMap.has(emailId)) {
        // Get original email (if exists)
        const emailDoc = await inboxCollection.doc(emailId).get();
        
        let threadId: string | null = null;
        let subject: string = "";
        let subjectSummary: string | undefined = undefined;
        let from: string = "";
        let fromEmail: string = "";
        let hasReplied: boolean = false;

        if (emailDoc.exists) {
          // Email exists, use email data
          const email = emailDoc.data();
          if (email) {
            threadId = email.threadId || reply.threadId || null;
            subject = email.subject || reply.subject || "";
            subjectSummary = email.subjectSummary || undefined;
            hasReplied = email.hasReplied || false;
            from = email.from || "";
            fromEmail = email.from.includes("<")
              ? email.from.split("<")[1].split(">")[0]
              : email.from;
          } else {
            // Email doesn't exist (was deleted), use reply data
            threadId = reply.threadId || null;
            subject = reply.subject || "";
            from = reply.from || "";
            fromEmail = reply.from.includes("<")
              ? reply.from.split("<")[1].split(">")[0]
              : reply.from;
          }
        } else {
          // Email doesn't exist (was deleted), use reply data
          threadId = reply.threadId || null;
          subject = reply.subject || "";
          from = reply.from || "";
          fromEmail = reply.from.includes("<")
            ? reply.from.split("<")[1].split(">")[0]
            : reply.from;
        }

        threadMap.set(emailId, {
          emailId: emailId,
          threadId: threadId,
          subject: subject,
          subjectSummary: subjectSummary,
          from: from,
          fromEmail: fromEmail,
          lastMessageAt: reply.sentAt?.toDate?.() || new Date(reply.sentAt),
          unreadCount: 0, // Will be updated from Gmail
          hasTask: emailIdsWithTasks.has(emailId),
          hasReplied: hasReplied,
        });
      } else {
        const thread = threadMap.get(emailId)!;
        const replyDate = reply.sentAt?.toDate?.() || new Date(reply.sentAt);
        if (replyDate > thread.lastMessageAt) {
          thread.lastMessageAt = replyDate;
        }
      }
    }

    // Sync new messages and get unread count from Gmail for each thread (in parallel for better performance)
    const threads = Array.from(threadMap.values());
    
    // Import fetchThreadMessages for syncing
    const { fetchThreadMessages } = await import("@/lib/gmail");
    const { FieldValue } = await import("firebase-admin/firestore");
    const userEmail = user.email || "";
    
    // Process threads in parallel (batch of 10 at a time to avoid overwhelming Gmail API)
    const BATCH_SIZE = 10;
    for (let i = 0; i < threads.length; i += BATCH_SIZE) {
      const batchThreads = threads.slice(i, i + BATCH_SIZE);
      
      await Promise.all(batchThreads.map(async (thread) => {
        if (!thread.threadId) {
          thread.unreadCount = 0;
          return;
        }
        
        try {
          // Sync new messages from Gmail to Firebase (quick sync)
          try {
            const threadMessages = await fetchThreadMessages(userId, thread.threadId);
            const existingRepliesSnapshot = await repliesCollection
              .where("emailId", "==", thread.emailId)
              .get();
            
            const existingExternalIds = new Set(
              existingRepliesSnapshot.docs
                .map(doc => {
                  const data = doc.data();
                  return data.externalMessageId || null;
                })
                .filter(id => id !== null && id !== undefined)
            );

            const newMessages: any[] = [];

            for (const msg of threadMessages) {
              if (existingExternalIds.has(msg.id)) {
                continue;
              }

              const recipientEmail = msg.isSent 
                ? (msg.to.includes("<") ? msg.to.split("<")[1].split(">")[0] : msg.to)
                : userEmail;

              newMessages.push({
                emailId: thread.emailId,
                externalMessageId: msg.id,
                threadId: thread.threadId,
                subject: msg.subject || "",
                body: msg.body || "",
                from: msg.from || userEmail,
                to: recipientEmail,
                sentAt: msg.sentAt,
              });
            }

            // Batch write new messages
            if (newMessages.length > 0) {
              const batchSize = 500;
              for (let j = 0; j < newMessages.length; j += batchSize) {
                const batchMessages = newMessages.slice(j, j + batchSize);
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
              }
              console.log(`[Chatting Threads] Synced ${newMessages.length} new messages for thread ${thread.emailId}`);
            }
          } catch (syncError) {
            console.error(`[Chatting Threads] Failed to sync messages for thread ${thread.threadId}:`, syncError);
            // Continue to get unread count even if sync fails
          }
          
          // Get unread count from Gmail
          thread.unreadCount = await getThreadUnreadCount(userId, thread.threadId);
        } catch (error) {
          console.error(`[Chatting Threads] Failed to process thread ${thread.threadId}:`, error);
          thread.unreadCount = 0;
        }
      }));
    }

    // Sort by last message time (descending)
    threads.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());

    return NextResponse.json({
      success: true,
      threads,
    });
  } catch (error: any) {
    console.error("[Chatting Threads] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch threads" },
      { status: 500 }
    );
  }
}

