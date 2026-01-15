import "dotenv/config";
import { db, COLLECTIONS } from "../lib/firebase";

/**
 * 기존 사용자 문서들의 문서 ID를 NextAuth user.id와 일치하도록 마이그레이션
 * 
 * 이 스크립트는:
 * 1. users 컬렉션의 모든 문서를 조회
 * 2. 각 문서의 id 필드가 문서 ID와 다른 경우, 새 문서 ID로 복사
 * 3. accounts, sessions 컬렉션의 userId 참조 업데이트
 * 4. users/{uid}/inbox, users/{uid}/tasks 등의 서브컬렉션도 새 경로로 이동
 */
async function migrateUserDocumentIds() {
  console.log("[Migrate User IDs] Starting migration...");

  // Get all users
  const usersSnapshot = await db.collection(COLLECTIONS.USERS).get();
  console.log(`[Migrate User IDs] Found ${usersSnapshot.size} users to process`);

  let migrated = 0;
  let skipped = 0;
  let errors = 0;

  for (const userDoc of usersSnapshot.docs) {
    const currentDocId = userDoc.id;
    const userData = userDoc.data();
    const userIdInData = userData.id;

    // Skip if document ID already matches the id field
    if (currentDocId === userIdInData) {
      console.log(`[Migrate User IDs] User ${currentDocId} already has matching document ID, skipping`);
      skipped++;
      continue;
    }

    // Skip if no id field in data
    if (!userIdInData) {
      console.log(`[Migrate User IDs] User ${currentDocId} has no id field, skipping`);
      skipped++;
      continue;
    }

    try {
      console.log(`[Migrate User IDs] Migrating user ${currentDocId} -> ${userIdInData}`);

      // Check if target document already exists
      const targetDoc = await db.collection(COLLECTIONS.USERS).doc(userIdInData).get();
      if (targetDoc.exists) {
        console.log(`[Migrate User IDs] Target document ${userIdInData} already exists, skipping`);
        skipped++;
        continue;
      }

      // Create new document with correct ID
      await db.collection(COLLECTIONS.USERS).doc(userIdInData).set({
        ...userData,
        id: userIdInData, // Ensure id field matches document ID
      });

      // Update accounts collection
      const accountsSnapshot = await db
        .collection(COLLECTIONS.ACCOUNTS)
        .where("userId", "==", currentDocId)
        .get();
      
      for (const accountDoc of accountsSnapshot.docs) {
        await accountDoc.ref.update({ userId: userIdInData });
        console.log(`[Migrate User IDs] Updated account ${accountDoc.id}`);
      }

      // Update sessions collection
      const sessionsSnapshot = await db
        .collection(COLLECTIONS.SESSIONS)
        .where("userId", "==", currentDocId)
        .get();
      
      for (const sessionDoc of sessionsSnapshot.docs) {
        await sessionDoc.ref.update({ userId: userIdInData });
        console.log(`[Migrate User IDs] Updated session ${sessionDoc.id}`);
      }

      // Migrate subcollections (inbox, tasks, rules, etc.)
      const subcollections = ["inbox", "tasks", "rules", "favorites", "templates", "replies", "calendar"];
      for (const subcollection of subcollections) {
        const oldSubcollectionRef = userDoc.ref.collection(subcollection);
        const newSubcollectionRef = db.collection(COLLECTIONS.USERS).doc(userIdInData).collection(subcollection);
        
        const subcollectionSnapshot = await oldSubcollectionRef.get();
        if (!subcollectionSnapshot.empty) {
          const batch = db.batch();
          for (const subDoc of subcollectionSnapshot.docs) {
            const newSubDocRef = newSubcollectionRef.doc(subDoc.id);
            batch.set(newSubDocRef, subDoc.data());
          }
          await batch.commit();
          console.log(`[Migrate User IDs] Migrated ${subcollectionSnapshot.size} documents from ${subcollection}`);
        }
      }

      // Delete old document
      await userDoc.ref.delete();
      console.log(`[Migrate User IDs] Deleted old document ${currentDocId}`);

      migrated++;
    } catch (error) {
      console.error(`[Migrate User IDs] Error migrating user ${currentDocId}:`, error);
      errors++;
    }
  }

  console.log(`[Migrate User IDs] Migration complete:`);
  console.log(`  - Migrated: ${migrated}`);
  console.log(`  - Skipped: ${skipped}`);
  console.log(`  - Errors: ${errors}`);
}

migrateUserDocumentIds()
  .then(() => {
    console.log("[Migrate User IDs] Done");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[Migrate User IDs] Fatal error:", error);
    process.exit(1);
  });

