import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { db, COLLECTIONS } from "@/lib/firebase";
import { cookies } from "next/headers";

export const runtime = 'nodejs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check session
    const session = await auth();
    
    // Check cookies
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("authjs.session-token") || cookieStore.get("__Secure-authjs.session-token");
    
    // Check Firebase connection and data
    const usersSnapshot = await db.collection(COLLECTIONS.USERS).limit(5).get();
    const sessionsSnapshot = await db.collection(COLLECTIONS.SESSIONS).limit(5).get();
    const accountsSnapshot = await db.collection(COLLECTIONS.ACCOUNTS).limit(5).get();

    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      email: doc.data().email,
      name: doc.data().name,
    }));

    const sessions = sessionsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        userId: data.userId,
        expires: data.expires,
        sessionToken: data.sessionToken?.substring(0, 20) + "...",
      };
    });

    return NextResponse.json({
      session: session ? {
        user: session.user,
        expires: session.expires,
      } : null,
      cookie: {
        exists: !!sessionCookie,
        name: sessionCookie?.name,
        value: sessionCookie?.value?.substring(0, 20) + "...",
      },
      firebase: {
        connected: true,
        usersCount: usersSnapshot.size,
        sessionsCount: sessionsSnapshot.size,
        accountsCount: accountsSnapshot.size,
        users: users,
        sessions: sessions,
      },
      env: {
        hasAuthSecret: !!process.env.AUTH_SECRET,
        hasFirebaseProjectId: !!process.env.FIREBASE_PROJECT_ID,
        hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
        authSecretLength: process.env.AUTH_SECRET?.length || 0,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}

