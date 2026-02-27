/**
 * Callback for "Connect Google" (link account to current user).
 * Add this URL to Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client → Authorized redirect URIs:
 *   - http://localhost:3000/api/auth/callback/link/google
 *   - https://your-domain.com/api/auth/callback/link/google
 */
import { db, COLLECTIONS } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { verifyLinkCookie } from "@/lib/link-google";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const COOKIE_NAME = "luminary_link_user_id";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const baseUrl = process.env.NEXTAUTH_URL || new URL(request.url).origin;
  const redirectUri = `${baseUrl}/api/auth/callback/link/google`;

  if (error) {
    return NextResponse.redirect(new URL(`/settings?link_error=${encodeURIComponent(error)}`, baseUrl));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/settings?link_error=no_code", baseUrl));
  }

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const userId = verifyLinkCookie(cookieHeader);
  if (!userId) {
    return NextResponse.redirect(new URL("/settings?link_error=session_expired", baseUrl));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/settings?link_error=config", baseUrl));
  }

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error("[link/google] Token exchange failed:", err);
    return NextResponse.redirect(new URL(`/settings?link_error=token`, baseUrl));
  }
  const tokens = await tokenRes.json();
  const access_token = tokens.access_token;
  const refresh_token = tokens.refresh_token;
  const expires_in = tokens.expires_in;
  const scope = tokens.scope;
  if (!access_token || !refresh_token) {
    return NextResponse.redirect(new URL("/settings?link_error=no_tokens", baseUrl));
  }

  const expires_at = expires_in ? Math.floor(Date.now() / 1000) + Number(expires_in) : null;

  const userInfoRes = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + encodeURIComponent(access_token)
  );
  if (!userInfoRes.ok) {
    return NextResponse.redirect(new URL("/settings?link_error=userinfo", baseUrl));
  }
  const profile = await userInfoRes.json();
  const providerAccountId = profile.id || profile.sub || String(profile.email);

  const existing = await db
    .collection(COLLECTIONS.ACCOUNTS)
    .where("userId", "==", userId)
    .where("provider", "==", "google")
    .where("providerAccountId", "==", providerAccountId)
    .limit(1)
    .get();

  const accountData = {
    userId,
    provider: "google",
    type: "oauth",
    providerAccountId,
    access_token,
    refresh_token,
    expires_at,
    scope: scope || null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (!existing.empty) {
    await existing.docs[0].ref.update({
      ...accountData,
      updatedAt: FieldValue.serverTimestamp(),
    });
  } else {
    await db.collection(COLLECTIONS.ACCOUNTS).add(accountData);
  }

  const res = NextResponse.redirect(new URL("/settings", baseUrl));
  res.headers.set("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return res;
}
