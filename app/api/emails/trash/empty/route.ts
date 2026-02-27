import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserEmailCollectionRefFromResolved, db } from "@/lib/firebase";
import { deleteGmailMessage } from "@/lib/gmail";

export const dynamic = 'force-dynamic';

/**
 * Permanently delete all trashed emails for the current user
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

    // Get all trashed emails
    const snapshot = await inboxCollection.where("isTrashed", "==", true).get();
    const emailCount = snapshot.size;

    if (emailCount === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: "휴지통이 비어있습니다.",
      });
    }

    // Permanently delete emails from Gmail and Firebase
    const batchSize = 100; // Smaller batch size for Gmail API calls
    let deleted = 0;
    let failed = 0;

    for (let i = 0; i < snapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = snapshot.docs.slice(i, i + batchSize);

      for (const doc of batchDocs) {
        const emailData = doc.data();
        const externalId = emailData.externalId; // Gmail message ID

        if (externalId) {
          try {
            // Permanently delete from Gmail
            await deleteGmailMessage(userId, externalId);
            // Delete from Firebase
            batch.delete(doc.ref);
            deleted++;
          } catch (error: any) {
            console.error(`[Delete Email] Failed to delete email ${externalId}:`, error);
            failed++;
            // Still delete from Firebase even if Gmail API fails
            batch.delete(doc.ref);
          }
        } else {
          // No externalId, just delete from Firebase
          batch.delete(doc.ref);
          deleted++;
        }
      }

      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      deleted,
      failed,
      message: `${deleted}개의 이메일이 영구 삭제되었습니다.${failed > 0 ? ` (${failed}개 실패)` : ""}`,
    });
  } catch (error: any) {
    console.error("[Empty Trash] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to empty trash" },
      { status: 500 }
    );
  }
}

