import type {
  Adapter,
  AdapterUser,
  AdapterAccount,
  AdapterSession,
  VerificationToken,
} from "next-auth/adapters";
import { db, COLLECTIONS } from "./firebase";
import { FieldValue } from "firebase-admin/firestore";

export function FirebaseAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, "id">) {
      console.log("[FirebaseAdapter] createUser called with:", {
        email: user.email,
        name: user.name,
        hasEmail: !!user.email,
      });
      
      console.log("[FirebaseAdapter] Creating new user in Firebase...");
      
      // Generate UUID to use as document ID
      // This ensures document ID matches the user ID returned to NextAuth
      const { randomUUID } = await import("crypto");
      const userId = randomUUID();
      
      const userRef = db.collection(COLLECTIONS.USERS).doc(userId);
      await userRef.set({
        ...user,
        id: userId, // Store ID in data as well for consistency
        emailVerified: user.emailVerified?.toISOString() || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      console.log("[FirebaseAdapter] User document created with ID:", userId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) {
        console.error("[FirebaseAdapter] User document was not created!");
        throw new Error("Failed to create user document");
      }
      
      const createdUser = {
        id: userId,
        ...userDoc.data(),
        emailVerified: userDoc.data()?.emailVerified
          ? new Date(userDoc.data()!.emailVerified)
          : null,
      } as AdapterUser;
      console.log("[FirebaseAdapter] User created successfully with ID:", createdUser.id, "Email:", createdUser.email);
      
      // Verify the user can be retrieved immediately
      const verifyDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
      if (!verifyDoc.exists) {
        console.error("[FirebaseAdapter] WARNING: Created user cannot be retrieved immediately!");
      } else {
        console.log("[FirebaseAdapter] User verification: can be retrieved immediately");
      }
      
      return createdUser;
    },

    async getUser(id: string) {
      const userDoc = await db.collection(COLLECTIONS.USERS).doc(id).get();
      if (!userDoc.exists) {
        return null;
      }
      const data = userDoc.data();
      return {
        id: userDoc.id,
        ...data,
        emailVerified: data?.emailVerified
          ? new Date(data.emailVerified)
          : null,
      } as AdapterUser;
    },

    async getUserByEmail(email: string) {
      // Optimized: Single query with index on email field
      // Index required: users collection on email field
      try {
        const snapshot = await db
          .collection(COLLECTIONS.USERS)
          .where("email", "==", email)
          .limit(1)
          .get();
        
        if (snapshot.empty) {
          return null;
        }
        
        const userDoc = snapshot.docs[0];
        const data = userDoc.data();
        return {
          id: userDoc.id,
          ...data,
          emailVerified: data?.emailVerified
            ? new Date(data.emailVerified)
            : null,
        } as AdapterUser;
      } catch (error) {
        console.error("[FirebaseAdapter] Error in getUserByEmail:", error);
        return null;
      }
    },

    async getUserByAccount({
      providerAccountId,
      provider,
    }: {
      providerAccountId: string;
      provider: string;
    }) {
      // Optimized: Use single field query with composite index
      // Index required: accounts collection on (provider, providerAccountId)
      try {
        const accountSnapshot = await db
          .collection(COLLECTIONS.ACCOUNTS)
          .where("provider", "==", provider)
          .where("providerAccountId", "==", providerAccountId)
          .limit(1)
          .get();

        if (accountSnapshot.empty) {
          return null;
        }

        const accountDoc = accountSnapshot.docs[0];
        const accountData = accountDoc.data();
        const userId = accountData.userId;

        if (!userId) {
          return null;
        }

        // Direct document access (no query)
        const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
        if (!userDoc.exists) {
          return null;
        }

        const userData = userDoc.data();
        return {
          id: userDoc.id,
          ...userData,
          emailVerified: userData?.emailVerified
            ? new Date(userData.emailVerified)
            : null,
        } as AdapterUser;
      } catch (error) {
        console.error("[FirebaseAdapter] Error in getUserByAccount:", error);
        return null;
      }
    },

    async updateUser(user: Partial<AdapterUser> & { id: string }) {
      const { id, ...updateData } = user;
      await db
        .collection(COLLECTIONS.USERS)
        .doc(id)
        .update({
          ...updateData,
          emailVerified: updateData.emailVerified?.toISOString(),
          updatedAt: FieldValue.serverTimestamp(),
        });

      const userDoc = await db.collection(COLLECTIONS.USERS).doc(id).get();
      const data = userDoc.data();
      return {
        id: userDoc.id,
        ...data,
        emailVerified: data?.emailVerified
          ? new Date(data.emailVerified)
          : null,
      } as AdapterUser;
    },

    async linkAccount(account: AdapterAccount) {
      // Optimized: Direct document access, no retries
      const userDoc = await db.collection(COLLECTIONS.USERS).doc(account.userId).get();
      
      if (!userDoc.exists) {
        throw new Error(`Cannot link account: User not found: ${account.userId}`);
      }
      
      // Check if account already exists (optimized with composite index)
      const existingAccount = await db
        .collection(COLLECTIONS.ACCOUNTS)
        .where("provider", "==", account.provider)
        .where("providerAccountId", "==", account.providerAccountId)
        .limit(1)
        .get();
      
      if (!existingAccount.empty) {
        const accountDoc = existingAccount.docs[0];
        const existingData = accountDoc.data();
        const updateData: Record<string, unknown> = {
          ...account,
          updatedAt: FieldValue.serverTimestamp(),
        };
        // Google은 재로그인 시 refresh_token을 다시 주지 않으므로, 기존에 저장된 토큰 보존
        if (updateData.refresh_token == null && existingData.refresh_token != null) {
          updateData.refresh_token = existingData.refresh_token;
        }
        if (updateData.access_token == null && existingData.access_token != null) {
          updateData.access_token = existingData.access_token;
        }
        if (updateData.expires_at == null && existingData.expires_at != null) {
          updateData.expires_at = existingData.expires_at;
        }
        await accountDoc.ref.update(updateData);
        console.log("[FirebaseAdapter] Account already exists, updated (tokens preserved if missing)");
        return account;
      }
      
      const newAccountRef = await db.collection(COLLECTIONS.ACCOUNTS).add({
        ...account,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      const savedAccount = await newAccountRef.get();
      if (account.provider === "google") {
        console.log("[FirebaseAdapter] Created new Google account:", {
          accountId: savedAccount.id,
          userId: account.userId,
          hasAccessToken: !!account.access_token,
          hasRefreshToken: !!account.refresh_token,
          accessTokenLength: account.access_token?.length || 0,
          refreshTokenLength: account.refresh_token?.length || 0,
          expiresAt: account.expires_at,
          scope: account.scope,
        });
      }
      return account;
    },

    async unlinkAccount({
      providerAccountId,
      provider,
    }: {
      providerAccountId: string;
      provider: string;
    }) {
      const snapshot = await db
        .collection(COLLECTIONS.ACCOUNTS)
        .where("provider", "==", provider)
        .where("providerAccountId", "==", providerAccountId)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        await snapshot.docs[0].ref.delete();
      }
    },

    async createSession(session: {
      sessionToken: string;
      userId: string;
      expires: Date;
    }) {
      // Optimized: Direct document access, no retries
      const userDoc = await db.collection(COLLECTIONS.USERS).doc(session.userId).get();
      
      if (!userDoc.exists) {
        throw new Error(`User not found: ${session.userId}`);
      }

      const sessionRef = await db.collection(COLLECTIONS.SESSIONS).add({
        ...session,
        expires: session.expires.toISOString(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      const sessionDoc = await sessionRef.get();
      const sessionData = sessionDoc.data();
      return {
        id: sessionDoc.id,
        sessionToken: sessionData?.sessionToken || session.sessionToken,
        userId: sessionData?.userId || session.userId,
        expires: new Date(sessionData?.expires || session.expires),
      } as AdapterSession;
    },

    async getSessionAndUser(sessionToken: string) {
      try {
        // Optimized: Single query with index on sessionToken
        const snapshot = await db
          .collection(COLLECTIONS.SESSIONS)
          .where("sessionToken", "==", sessionToken)
          .limit(1)
          .get();

        if (snapshot.empty) {
          return null;
        }

        const sessionDoc = snapshot.docs[0];
        const sessionData = sessionDoc.data();
        const userId = sessionData.userId;

        if (!userId) {
          // Clean up invalid session
          await sessionDoc.ref.delete();
          return null;
        }

        // Optimized: Direct document access, no retries
        const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
        
        if (!userDoc.exists) {
          // Clean up orphaned session
          await sessionDoc.ref.delete();
          return null;
        }

        const userData = userDoc.data();
        
        // Handle both string and Date formats
        let expires: Date;
        if (typeof sessionData.expires === 'string') {
          expires = new Date(sessionData.expires);
        } else if (sessionData.expires?.toDate) {
          expires = sessionData.expires.toDate();
        } else {
          expires = new Date(sessionData.expires);
        }

        if (expires < new Date()) {
          // Session expired, delete it
          await sessionDoc.ref.delete();
          return null;
        }

        return {
          session: {
            id: sessionDoc.id,
            sessionToken: sessionData.sessionToken,
            userId: sessionData.userId,
            expires,
          } as AdapterSession,
          user: {
            id: userDoc.id,
            ...userData,
            emailVerified: userData?.emailVerified
              ? new Date(userData.emailVerified)
              : null,
          } as AdapterUser,
        };
      } catch (error) {
        console.error("[FirebaseAdapter] Error in getSessionAndUser:", error);
        return null;
      }
    },

    async updateSession(session: Partial<AdapterSession> & {
      sessionToken: string;
    }) {
      const snapshot = await db
        .collection(COLLECTIONS.SESSIONS)
        .where("sessionToken", "==", session.sessionToken)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const sessionDoc = snapshot.docs[0];
      await sessionDoc.ref.update({
        ...session,
        expires: session.expires?.toISOString(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const updatedDoc = await sessionDoc.ref.get();
      const data = updatedDoc.data();
      return {
        id: updatedDoc.id,
        ...data,
        expires: new Date(data!.expires),
      } as unknown as AdapterSession;
    },

    async deleteSession(sessionToken: string) {
      const snapshot = await db
        .collection(COLLECTIONS.SESSIONS)
        .where("sessionToken", "==", sessionToken)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        await snapshot.docs[0].ref.delete();
      }
    },

    async createVerificationToken(verificationToken: VerificationToken) {
      await db.collection(COLLECTIONS.VERIFICATION_TOKENS).add({
        ...verificationToken,
        expires: verificationToken.expires.toISOString(),
        createdAt: FieldValue.serverTimestamp(),
      });
      return verificationToken;
    },

    async useVerificationToken({
      identifier,
      token,
    }: {
      identifier: string;
      token: string;
    }) {
      const snapshot = await db
        .collection(COLLECTIONS.VERIFICATION_TOKENS)
        .where("identifier", "==", identifier)
        .where("token", "==", token)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const tokenDoc = snapshot.docs[0];
      const tokenData = tokenDoc.data();
      const expires = new Date(tokenData.expires);

      if (expires < new Date()) {
        await tokenDoc.ref.delete();
        return null;
      }

      await tokenDoc.ref.delete();
      return {
        identifier: tokenData.identifier,
        token: tokenData.token,
        expires,
      } as VerificationToken;
    },
  };
}

