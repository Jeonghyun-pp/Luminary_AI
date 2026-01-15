import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserSubcollectionRefFromResolved, getUserEmailCollectionRefFromResolved, getUserTaskCollectionRefFromResolved } from "@/lib/firebase";
import { getThreadUnreadCount } from "@/lib/gmail";

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
      from: string;
      fromEmail: string;
      lastMessageAt: Date;
      unreadCount: number;
      hasTask: boolean;
    }>();

    for (const replyDoc of repliesSnapshot.docs) {
      const reply = replyDoc.data();
      const emailId = reply.emailId;

      if (!threadMap.has(emailId)) {
        // Get original email (if exists)
        const emailDoc = await inboxCollection.doc(emailId).get();
        
        let threadId: string | null = null;
        let subject: string = "";
        let from: string = "";
        let fromEmail: string = "";

        if (emailDoc.exists) {
          // Email exists, use email data
          const email = emailDoc.data();
          if (email) {
            threadId = email.threadId || reply.threadId || null;
            subject = email.subject || reply.subject || "";
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
          from: from,
          fromEmail: fromEmail,
          lastMessageAt: reply.sentAt?.toDate?.() || new Date(reply.sentAt),
          unreadCount: 0, // Will be updated from Gmail
          hasTask: emailIdsWithTasks.has(emailId),
        });
      } else {
        const thread = threadMap.get(emailId)!;
        const replyDate = reply.sentAt?.toDate?.() || new Date(reply.sentAt);
        if (replyDate > thread.lastMessageAt) {
          thread.lastMessageAt = replyDate;
        }
      }
    }

    // Get unread count from Gmail for each thread
    const threads = Array.from(threadMap.values());
    for (const thread of threads) {
      if (thread.threadId) {
        try {
          thread.unreadCount = await getThreadUnreadCount(userId, thread.threadId);
        } catch (error) {
          console.error(`[Chatting Threads] Failed to get unread count for thread ${thread.threadId}:`, error);
          thread.unreadCount = 0;
        }
      }
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

