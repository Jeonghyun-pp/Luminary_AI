import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserEmailCollectionRefFromResolved } from "@/lib/firebase";
import { trashGmailMessage } from "@/lib/gmail";

export const dynamic = 'force-dynamic';

export async function DELETE(
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

    const emailData = emailDoc.data();
    const externalId = emailData?.externalId; // Gmail message ID

    // Move to trash in Gmail if externalId exists
    if (externalId) {
      try {
        await trashGmailMessage(userId, externalId);
      } catch (error: any) {
        console.error(`[Trash Email] Failed to trash email in Gmail:`, error);
        // Continue to mark as trashed in Firebase even if Gmail API fails
      }
    }

    // Mark as trashed in Firebase
    await inboxCollection.doc(emailId).update({
      isTrashed: true,
      trashedAt: new Date(),
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error: any) {
    console.error("[Trash Email] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trash email" },
      { status: 500 }
    );
  }
}

