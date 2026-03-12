import { auth } from "@/auth";
import { setAccountNickname } from "@/lib/user-settings";
import { db, COLLECTIONS } from "@/lib/firebase";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId, nickname } = await request.json();
  if (!accountId || typeof accountId !== "string") {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  // Verify the account belongs to this user
  const accountDoc = await db.collection(COLLECTIONS.ACCOUNTS).doc(accountId).get();
  if (!accountDoc.exists || accountDoc.data()?.userId !== session.user.id) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  await setAccountNickname(accountId, nickname?.trim() || null);
  return NextResponse.json({ success: true });
}
