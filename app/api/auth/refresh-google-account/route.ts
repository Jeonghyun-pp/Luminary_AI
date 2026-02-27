import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db, COLLECTIONS } from "@/lib/firebase";

export const dynamic = 'force-dynamic';

/**
 * Force refresh Google account by deleting and requiring re-login
 * This will ensure new scopes are applied
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Find and delete existing Google account
    const accountSnapshot = await db
      .collection(COLLECTIONS.ACCOUNTS)
      .where("userId", "==", userId)
      .where("provider", "==", "google")
      .limit(1)
      .get();

    if (!accountSnapshot.empty) {
      await accountSnapshot.docs[0].ref.delete();
    }

    return NextResponse.json({
      success: true,
      message: "Google account deleted. Please log out and log in again to apply new scopes.",
    });
  } catch (error: any) {
    console.error("[Refresh Google Account] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to refresh Google account" },
      { status: 500 }
    );
  }
}

