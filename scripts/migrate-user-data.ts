import "dotenv/config";
import {
  db,
  resolveUserDocument,
  getUserEmailCollectionRefFromResolved,
  getUserTaskCollectionRefFromResolved,
  getUserRuleCollectionRefFromResolved,
} from "../lib/firebase";

const SHOULD_DELETE_SOURCE = process.env.DELETE_LEGACY_COLLECTIONS === "true";

async function migrateEmails() {
  const snapshot = await db.collection("emails").get();
  console.log(`[migrate] emails: ${snapshot.size} documents to process`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const userId = data.userId;

    if (!userId) {
      console.warn(`[migrate] skipping email ${doc.id} - missing userId`);
      continue;
    }

    try {
      const { ref: userRef } = await resolveUserDocument(userId);
      const inboxCollection = getUserEmailCollectionRefFromResolved(userRef);
      const targetDoc = inboxCollection.doc(doc.id);
      const exists = await targetDoc.get();

      if (exists.exists) {
        console.log(`[migrate] email ${doc.id} already migrated, skipping`);
        continue;
      }

      await targetDoc.set(data);
      if (SHOULD_DELETE_SOURCE) {
        await doc.ref.delete();
      }
      console.log(`[migrate] email ${doc.id} moved under users/${userId}/inbox`);
    } catch (error) {
      console.error(`[migrate] failed to migrate email ${doc.id}:`, error);
    }
  }
}

async function migrateTasks() {
  const snapshot = await db.collection("tasks").get();
  console.log(`[migrate] tasks: ${snapshot.size} documents to process`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const userId = data.userId;

    if (!userId) {
      console.warn(`[migrate] skipping task ${doc.id} - missing userId`);
      continue;
    }

    try {
      const { ref: userRef } = await resolveUserDocument(userId);
      const taskCollection = getUserTaskCollectionRefFromResolved(userRef);
      const targetDoc = taskCollection.doc(doc.id);
      const exists = await targetDoc.get();

      if (exists.exists) {
        console.log(`[migrate] task ${doc.id} already migrated, skipping`);
        continue;
      }

      await targetDoc.set(data);
      if (SHOULD_DELETE_SOURCE) {
        await doc.ref.delete();
      }
      console.log(`[migrate] task ${doc.id} moved under users/${userId}/tasks`);
    } catch (error) {
      console.error(`[migrate] failed to migrate task ${doc.id}:`, error);
    }
  }
}

async function migrateRules() {
  const snapshot = await db.collection("inboxRules").get();
  console.log(`[migrate] rules: ${snapshot.size} documents to process`);

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const userId = data.userId;

    if (!userId) {
      console.warn(`[migrate] skipping rule ${doc.id} - missing userId`);
      continue;
    }

    try {
      const { ref: userRef } = await resolveUserDocument(userId);
      const ruleCollection = getUserRuleCollectionRefFromResolved(userRef);
      const targetDoc = ruleCollection.doc(doc.id);
      const exists = await targetDoc.get();

      if (exists.exists) {
        console.log(`[migrate] rule ${doc.id} already migrated, skipping`);
        continue;
      }

      await targetDoc.set(data);
      if (SHOULD_DELETE_SOURCE) {
        await doc.ref.delete();
      }
      console.log(`[migrate] rule ${doc.id} moved under users/${userId}/rules`);
    } catch (error) {
      console.error(`[migrate] failed to migrate rule ${doc.id}:`, error);
    }
  }
}

async function run() {
  await migrateEmails();
  await migrateTasks();
  await migrateRules();
  console.log("[migrate] done");
  process.exit(0);
}

run().catch((error) => {
  console.error("[migrate] fatal error:", error);
  process.exit(1);
});

