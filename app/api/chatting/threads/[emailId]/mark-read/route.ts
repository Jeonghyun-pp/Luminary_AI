import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserSubcollectionRefFromResolved, getUserEmailCollectionRefFromResolved } from "@/lib/firebase";
import { markThreadAsRead } from "@/lib/gmail";

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
    const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);
    const repliesCollection = getUserSubcollectionRefFromResolved(userRef, "REPLIES");

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

    // Mark all messages in thread as read
    try {
      await markThreadAsRead(userId, threadId);
      console.log(`[Mark Thread Read] Successfully marked thread ${threadId} as read`);
    } catch (error: any) {
      console.error(`[Mark Thread Read] Error marking thread ${threadId} as read:`, error);
      throw error;
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("[Mark Thread Read] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to mark thread as read" },
      { status: 500 }
    );
  }
}

