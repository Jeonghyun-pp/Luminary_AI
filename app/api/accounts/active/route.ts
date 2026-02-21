import { auth } from "@/auth";
import { setActiveAccountId } from "@/lib/user-settings";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json();
  const accountId = body?.accountId ?? null;
  await setActiveAccountId(session.user.id, accountId);
  return NextResponse.json({ success: true });
}
