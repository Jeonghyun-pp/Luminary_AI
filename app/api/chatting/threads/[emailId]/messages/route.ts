import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserSubcollectionRefFromResolved, getUserEmailCollectionRefFromResolved } from "@/lib/firebase";

export async function GET(
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

    // Load messages from Firebase (replies collection)
    const repliesSnapshot = await repliesCollection
      .where("emailId", "==", emailId)
      .get();

    // Check if email exists (optional - for backward compatibility)
    const emailDoc = await inboxCollection.doc(emailId).get();
    const email = emailDoc.exists ? emailDoc.data() : null;

    // If no replies and no email, return error
    if (repliesSnapshot.empty && !emailDoc.exists) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    // Convert Firebase documents to message format
    let messages = repliesSnapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        subject: data.subject || "",
        body: data.body || "",
        from: data.from || "",
        to: data.to || "",
        sentAt: data.sentAt?.toDate?.() || new Date(data.sentAt),
        isSent: data.from === user.email, // Check if sent by current user
      };
    });

    // If no messages in replies but email exists, add original email as first message
    if (messages.length === 0 && emailDoc.exists && email) {
      messages.push({
        id: emailId,
        subject: email.subject || "",
        body: email.bodyFullText || email.bodySnippet || "",
        from: email.from || "",
        to: user.email || "",
        sentAt: email.receivedAt?.toDate?.() || new Date(email.receivedAt || Date.now()),
        isSent: false,
      });
    }

    // Sort by sentAt (in memory, no index needed)
    messages.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
    
    return NextResponse.json({
      success: true,
      messages: messages,
    });
  } catch (error: any) {
    console.error("[Chatting Messages] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
