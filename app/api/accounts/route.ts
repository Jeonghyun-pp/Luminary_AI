import { auth } from "@/auth";
import { getLinkedAccounts, getActiveAccountId } from "@/lib/user-settings";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const [accounts, activeAccountId] = await Promise.all([
    getLinkedAccounts(session.user.id),
    getActiveAccountId(session.user.id),
  ]);
  return NextResponse.json({ accounts, activeAccountId });
}
