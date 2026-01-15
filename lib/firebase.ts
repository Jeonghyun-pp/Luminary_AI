import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getFirestore, Firestore } from "firebase-admin/firestore";
import { readFileSync } from "fs";
import { join } from "path";

let app: App;
let db: Firestore;

// Initialize Firebase Admin
if (getApps().length === 0) {
  let serviceAccount: any = undefined;
  let projectId: string | undefined = undefined;

  // Priority 1: Environment variable with JSON string
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      projectId = serviceAccount.project_id;
    } catch (error) {
      console.error("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", error);
    }
  }

  // Priority 2: File path from environment variable
  if (!serviceAccount && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const filePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      const fileContent = readFileSync(filePath, "utf8");
      serviceAccount = JSON.parse(fileContent);
      projectId = serviceAccount.project_id;
    } catch (error) {
      console.error("Failed to read GOOGLE_APPLICATION_CREDENTIALS file:", error);
    }
  }

  // Priority 3: Look for Firebase service account key file in project root
  if (!serviceAccount) {
    try {
      const { readdirSync } = require("fs");
      const { join } = require("path");
      const files = readdirSync(process.cwd());
      const firebaseKeyFile = files.find((file: string) =>
        file.includes("firebase-adminsdk") && file.endsWith(".json")
      );

      if (firebaseKeyFile) {
        const filePath = join(process.cwd(), firebaseKeyFile);
        const fileContent = readFileSync(filePath, "utf8");
        serviceAccount = JSON.parse(fileContent);
        projectId = serviceAccount.project_id;
      }
    } catch (error) {
      // Ignore errors, will fall back to other methods
    }
  }

  // Priority 4: Use project ID from environment variable (Application Default Credentials)
  if (!projectId && process.env.FIREBASE_PROJECT_ID) {
    projectId = process.env.FIREBASE_PROJECT_ID;
  }

  if (!serviceAccount && !projectId) {
    throw new Error(
      "Firebase configuration missing. Please set one of:\n" +
      "1. FIREBASE_SERVICE_ACCOUNT_KEY (JSON string)\n" +
      "2. GOOGLE_APPLICATION_CREDENTIALS (file path)\n" +
      "3. Place firebase-adminsdk-*.json file in project root\n" +
      "4. FIREBASE_PROJECT_ID (for Application Default Credentials)"
    );
  }

  app = initializeApp({
    credential: serviceAccount ? cert(serviceAccount) : undefined,
    projectId: projectId,
  });
} else {
  app = getApps()[0];
}

db = getFirestore(app);

export { db };

// Collection names
export const COLLECTIONS = {
  USERS: "users",
  ACCOUNTS: "accounts",
  SESSIONS: "sessions",
  VERIFICATION_TOKENS: "verificationTokens",
} as const;

export const USER_SUBCOLLECTIONS = {
  INBOX: "inbox",
  TEMPLATES: "templates",
  FAVORITES: "favorites",
  REPLIES: "replies",
  TASKS: "tasks",
  CALENDAR: "calendar",
  RULES: "rules",
} as const;

export type UserSubcollectionKey = keyof typeof USER_SUBCOLLECTIONS;

export async function resolveUserDocument(
  userId: string
): Promise<{
  id: string;
  ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
}> {
  let userRef = db.collection(COLLECTIONS.USERS).doc(userId);
  let userDoc = await userRef.get();

  if (userDoc.exists) {
    return { id: userRef.id, ref: userRef };
  }

  const fallbackSnapshot = await db
    .collection(COLLECTIONS.USERS)
    .where("id", "==", userId)
    .limit(1)
    .get();

  if (!fallbackSnapshot.empty) {
    const fallbackDoc = fallbackSnapshot.docs[0];
    return { id: fallbackDoc.id, ref: fallbackDoc.ref };
  }

  throw new Error(`User document not found for id: ${userId}`);
}

export async function getUserSubcollectionRef(
  userId: string,
  subcollection: UserSubcollectionKey
) {
  const { ref } = await resolveUserDocument(userId);
  return ref.collection(USER_SUBCOLLECTIONS[subcollection]);
}

export function getUserSubcollectionRefFromResolved(
  userRef: FirebaseFirestore.DocumentReference,
  subcollection: UserSubcollectionKey
) {
  return userRef.collection(USER_SUBCOLLECTIONS[subcollection]);
}

export async function getUserEmailCollectionRef(userId: string) {
  return getUserSubcollectionRef(userId, "INBOX");
}

export function getUserEmailCollectionRefFromResolved(
  userRef: FirebaseFirestore.DocumentReference
) {
  return getUserSubcollectionRefFromResolved(userRef, "INBOX");
}

export async function getUserTaskCollectionRef(userId: string) {
  return getUserSubcollectionRef(userId, "TASKS");
}

export function getUserTaskCollectionRefFromResolved(
  userRef: FirebaseFirestore.DocumentReference
) {
  return getUserSubcollectionRefFromResolved(userRef, "TASKS");
}

export async function getUserRuleCollectionRef(userId: string) {
  return getUserSubcollectionRef(userId, "RULES");
}

export function getUserRuleCollectionRefFromResolved(
  userRef: FirebaseFirestore.DocumentReference
) {
  return getUserSubcollectionRefFromResolved(userRef, "RULES");
}

export async function getUserCalendarCollectionRef(userId: string) {
  return getUserSubcollectionRef(userId, "CALENDAR");
}

export function getUserCalendarCollectionRefFromResolved(
  userRef: FirebaseFirestore.DocumentReference
) {
  return getUserSubcollectionRefFromResolved(userRef, "CALENDAR");
}

// Helper functions for Firestore operations
export async function getDocById<T>(
  collection: string,
  id: string
): Promise<T | null> {
  const doc = await db.collection(collection).doc(id).get();
  if (!doc.exists) {
    return null;
  }
  return { id: doc.id, ...doc.data() } as T;
}

export async function getDocsByQuery<T>(
  collection: string,
  queryFn?: (query: FirebaseFirestore.Query) => FirebaseFirestore.Query
): Promise<T[]> {
  let query: FirebaseFirestore.Query = db.collection(collection);
  if (queryFn) {
    query = queryFn(query);
  }
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
}

export async function createDoc<T>(
  collection: string,
  data: Omit<T, "id">
): Promise<T> {
  const docRef = await db.collection(collection).add({
    ...data,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const doc = await docRef.get();
  return { id: doc.id, ...doc.data() } as T;
}

export async function updateDoc<T>(
  collection: string,
  id: string,
  data: Partial<T>
): Promise<T> {
  await db
    .collection(collection)
    .doc(id)
    .update({
      ...data,
      updatedAt: new Date(),
    });
  const doc = await db.collection(collection).doc(id).get();
  return { id: doc.id, ...doc.data() } as T;
}

export async function deleteDoc(collection: string, id: string): Promise<void> {
  await db.collection(collection).doc(id).delete();
}

export async function countDocs(
  collection: string,
  queryFn?: (query: FirebaseFirestore.Query) => FirebaseFirestore.Query
): Promise<number> {
  let query: FirebaseFirestore.Query = db.collection(collection);
  if (queryFn) {
    query = queryFn(query);
  }
  const snapshot = await query.count().get();
  return snapshot.data().count;
}

