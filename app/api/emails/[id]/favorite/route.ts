import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserDocument, getUserEmailCollectionRefFromResolved } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";

export const dynamic = 'force-dynamic';

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

    const currentIsStarred = emailDoc.data()?.isStarred || false;

    await inboxCollection.doc(emailId).update({
      isStarred: !currentIsStarred,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      isStarred: !currentIsStarred,
    });
  } catch (error: any) {
    console.error("[Favorite] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to toggle favorite" },
      { status: 500 }
    );
  }
}

