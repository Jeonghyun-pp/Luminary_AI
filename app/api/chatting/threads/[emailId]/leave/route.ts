import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserSubcollectionRefFromResolved, db } from "@/lib/firebase";

/**
 * Leave a chat thread by deleting all replies for the emailId
 */
export async function DELETE(
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

    // Get all replies for this emailId
    const repliesSnapshot = await repliesCollection
      .where("emailId", "==", emailId)
      .get();

    if (repliesSnapshot.empty) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        message: "삭제할 채팅이 없습니다.",
      });
    }

    // Delete in batches (Firestore has a limit of 500 operations per batch)
    const batchSize = 500;
    let deleted = 0;

    for (let i = 0; i < repliesSnapshot.docs.length; i += batchSize) {
      const batch = db.batch();
      const batchDocs = repliesSnapshot.docs.slice(i, i + batchSize);

      for (const doc of batchDocs) {
        batch.delete(doc.ref);
      }

      await batch.commit();
      deleted += batchDocs.length;
    }

    return NextResponse.json({
      success: true,
      deleted,
      message: `${deleted}개의 메시지가 삭제되었습니다.`,
    });
  } catch (error: any) {
    console.error("[Leave Thread] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to leave thread" },
      { status: 500 }
    );
  }
}

