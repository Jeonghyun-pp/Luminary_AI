import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { FirebaseAdapter } from "@/lib/firebase-adapter";
import { verifyCredentials } from "@/lib/auth-credentials";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: FirebaseAdapter(),
  session: {
    strategy: "database",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: `authjs.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
      },
    },
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await verifyCredentials(
          String(credentials.email),
          String(credentials.password)
        );
        return user;
      },
    }),
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: "openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/calendar",
          access_type: "offline",
        },
      },
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log("[NextAuth] signIn callback:", {
        userId: user?.id,
        email: user?.email,
        accountProvider: account?.provider,
        accountId: account?.providerAccountId,
        hasAccessToken: !!account?.access_token,
        hasRefreshToken: !!account?.refresh_token,
        accessTokenLength: account?.access_token?.length || 0,
        refreshTokenLength: account?.refresh_token?.length || 0,
        expiresAt: account?.expires_at,
        scope: account?.scope,
      });
      return true;
    },
    async session({ session, user }) {
      if (session.user && user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      console.log("[NextAuth] User created event:", { id: user.id, email: user.email });
    },
    async linkAccount({ account, user }) {
      console.log("[NextAuth] Account linked event:", {
        userId: user.id,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        hasAccessToken: !!account.access_token,
        hasRefreshToken: !!account.refresh_token,
        accessTokenLength: account.access_token?.length || 0,
        refreshTokenLength: account.refresh_token?.length || 0,
        expiresAt: account.expires_at,
        tokenType: account.token_type,
        scope: account.scope,
      });
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  trustHost: true,
  debug: process.env.NODE_ENV === "development",
});

