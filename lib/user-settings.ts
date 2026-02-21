import { db, COLLECTIONS } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";

export type LinkedAccount = {
  id: string; // Firestore document id
  provider: string;
  providerAccountId: string;
  email?: string | null;
  scope?: string | null;
};

/**
 * Get the active (selected) account id for the user.
 * Used for Gmail/Calendar and for scoping inbox, tasks, etc.
 */
export async function getActiveAccountId(userId: string): Promise<string | null> {
  const userDoc = await db.collection(COLLECTIONS.USERS).doc(userId).get();
  if (!userDoc.exists) return null;
  const data = userDoc.data();
  return (data?.activeAccountId as string) || null;
}

/**
 * Set the active account for the user.
 */
export async function setActiveAccountId(
  userId: string,
  accountId: string | null
): Promise<void> {
  await db.collection(COLLECTIONS.USERS).doc(userId).update({
    activeAccountId: accountId,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * List all linked accounts for the user (Google, Instagram, etc.).
 */
export async function getLinkedAccounts(userId: string): Promise<LinkedAccount[]> {
  const snapshot = await db
    .collection(COLLECTIONS.ACCOUNTS)
    .where("userId", "==", userId)
    .get();
  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      provider: data.provider as string,
      providerAccountId: data.providerAccountId as string,
      email: data.email as string | undefined,
      scope: data.scope as string | undefined,
    };
  });
}
