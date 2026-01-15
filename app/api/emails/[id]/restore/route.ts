import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserEmailCollectionRefFromResolved } from "@/lib/firebase";
import { untrashGmailMessage } from "@/lib/gmail";
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

    const { ref: userRef } = await resolveUserDocument(userId);
    const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);

    const emailDoc = await inboxCollection.doc(emailId).get();

    if (!emailDoc.exists) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }

    const email = emailDoc.data();
    const externalId = email?.externalId; // Gmail message ID

    // Restore from trash in Gmail if externalId exists
    if (externalId) {
      try {
        await untrashGmailMessage(userId, externalId);
      } catch (error: any) {
        console.error(`[Restore Email] Failed to untrash email in Gmail:`, error);
        // Continue to restore in Firebase even if Gmail API fails
      }
    }

    // Restore in Firebase by removing isTrashed flag
    await inboxCollection.doc(emailId).update({
      isTrashed: false,
      trashedAt: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("[Restore Email] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to restore email" },
      { status: 500 }
    );
  }
}

