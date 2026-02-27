import { auth } from "@/auth";
import { createLinkCookie, getGoogleOAuthLinkUrl } from "@/lib/link-google";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/auth/signin", request.url));
  }
  const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const redirectUri = `${baseUrl}/api/auth/callback/link/google`;
  const state = randomBytes(16).toString("hex");
  const url = getGoogleOAuthLinkUrl(redirectUri, state);
  const cookie = createLinkCookie(session.user.id);
  const res = NextResponse.redirect(url);
  res.headers.set("Set-Cookie", cookie);
  return res;
}
