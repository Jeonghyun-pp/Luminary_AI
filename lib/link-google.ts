import { createHmac } from "crypto";

const COOKIE_NAME = "luminary_link_user_id";
const COOKIE_MAX_AGE = 60 * 10; // 10 minutes

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required for link flow");
  return secret;
}

export function createLinkCookie(userId: string): string {
  const secret = getSecret();
  const sig = createHmac("sha256", secret).update(userId).digest("hex");
  const value = `${userId}.${sig}`;
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

export function verifyLinkCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  const value = decodeURIComponent(match[1].trim());
  const [userId, sig] = value.split(".");
  if (!userId || !sig) return null;
  const secret = getSecret();
  const expected = createHmac("sha256", secret).update(userId).digest("hex");
  if (sig !== expected) return null;
  return userId;
}

export function getGoogleOAuthLinkUrl(redirectUri: string, state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const scope = encodeURIComponent(
    "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar"
  );
  return (
    "https://accounts.google.com/o/oauth2/v2/auth?" +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    "&response_type=code" +
    `&scope=${scope}` +
    `&state=${encodeURIComponent(state)}` +
    "&access_type=offline" +
    "&prompt=consent"
  );
}
