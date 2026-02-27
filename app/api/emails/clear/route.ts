import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserEmailCollectionRefFromResolved, db } from "@/lib/firebase";
import { trashGmailMessage } from "@/lib/gmail";

export const dynamic = 'force-dynamic';

/**
 * Move all emails to trash for the current user
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;
    const { ref: userRef } = await resolveUserDocument(userId);
    const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);

    // Get all emails
    const snapshot = await inboxCollection.get();
    const emailCount = snapshot.size;

    if (emailCount === 0) {
      return NextResponse.json({
        success: true,
        trashed: 0,
        message: "이메일이 없습니다.",
      });
    }

    // Move emails to trash in Gmail and mark as trashed in Firebase
    const batchSize = 100; // Smaller batch size for Gmail API calls
    let trashed = 0;
    let failed = 0;

    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = snapshot.docs.slice(i, i + batchSize);

      for (const doc of batchDocs) {
        const emailData = doc.data();
        const externalId = emailData.externalId; // Gmail message ID

        if (externalId) {
          try {
            // Move to trash in Gmail
            await trashGmailMessage(userId, externalId);
            // Mark as trashed in Firebase
            batch.update(doc.ref, { isTrashed: true, trashedAt: new Date() });
            trashed++;
          } catch (error: any) {
            console.error(`[Trash Email] Failed to trash email ${externalId}:`, error);
            failed++;
            // Still mark as trashed in Firebase even if Gmail API fails
            batch.update(doc.ref, { isTrashed: true, trashedAt: new Date() });
          }
        } else {
          // No externalId, just mark as trashed in Firebase
          batch.update(doc.ref, { isTrashed: true, trashedAt: new Date() });
          trashed++;
        }
      }

      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      trashed,
      failed,
      message: `${trashed}개의 이메일이 휴지통으로 이동되었습니다.${failed > 0 ? ` (${failed}개 실패)` : ""}`,
    });
  } catch (error: any) {
    console.error("[Trash Emails] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to trash emails" },
      { status: 500 }
    );
  }
}

