"use server";

import { db, COLLECTIONS } from "@/lib/firebase";
import { FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

export type UserWithPassword = {
  id: string;
  email: string | null;
  name: string | null;
  passwordHash?: string;
};

/**
 * Create a new user with email/password (for sign-up).
 * Stores user in Firebase users collection with passwordHash.
 */
export async function createUserWithPassword(
  email: string,
  password: string,
  name?: string | null
): Promise<{ id: string; email: string; name: string | null } | { error: string }> {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail || !password) {
    return { error: "이메일과 비밀번호를 입력해주세요." };
  }
  if (password.length < 8) {
    return { error: "비밀번호는 8자 이상이어야 합니다." };
  }

  const existing = await db
    .collection(COLLECTIONS.USERS)
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();
  if (!existing.empty) {
    return { error: "이미 사용 중인 이메일입니다." };
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const userId = randomUUID();
  await db
    .collection(COLLECTIONS.USERS)
    .doc(userId)
    .set({
      id: userId,
      email: normalizedEmail,
      name: name?.trim() || null,
      emailVerified: null,
      passwordHash,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

  return { id: userId, email: normalizedEmail, name: name?.trim() || null };
}

/**
 * Verify email/password and return user for NextAuth Credentials authorize.
 * Does not return passwordHash.
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<{ id: string; email: string; name: string | null } | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const snapshot = await db
    .collection(COLLECTIONS.USERS)
    .where("email", "==", normalizedEmail)
    .limit(1)
    .get();
  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  const data = doc.data();
  const passwordHash = data.passwordHash as string | undefined;
  if (!passwordHash) return null; // OAuth-only user, no password

  const valid = await bcrypt.compare(password, passwordHash);
  if (!valid) return null;

  return {
    id: doc.id,
    email: (data.email as string) || normalizedEmail,
    name: (data.name as string) || null,
  };
}
