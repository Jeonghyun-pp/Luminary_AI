import "dotenv/config";
import * as readline from "readline";
import { db } from "../lib/firebase";

/**
 * 레거시 컬렉션 삭제 스크립트
 * 
 * 주의: 이 스크립트는 다음 컬렉션의 모든 문서를 삭제합니다:
 * - emails
 * - tasks
 * - inboxRules
 * 
 * 실행 전에 새 구조(users/{uid}/inbox, users/{uid}/tasks, users/{uid}/rules)에
 * 모든 데이터가 정상적으로 마이그레이션되었는지 확인하세요.
 */

async function deleteLegacyCollections() {
  console.log("[Delete Legacy] Starting deletion of legacy collections...");

  const collectionsToDelete = ["emails", "tasks", "inboxRules"];

  for (const collectionName of collectionsToDelete) {
    try {
      console.log(`[Delete Legacy] Processing collection: ${collectionName}`);
      
      const snapshot = await db.collection(collectionName).get();
      console.log(`[Delete Legacy] Found ${snapshot.size} documents in ${collectionName}`);

      if (snapshot.size === 0) {
        console.log(`[Delete Legacy] Collection ${collectionName} is already empty, skipping`);
        continue;
      }

      // Delete in batches (Firestore has a limit of 500 operations per batch)
      const batchSize = 500;
      let deleted = 0;

      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = db.batch();
        const batchDocs = snapshot.docs.slice(i, i + batchSize);

        for (const doc of batchDocs) {
          batch.delete(doc.ref);
        }

        await batch.commit();
        deleted += batchDocs.length;
        console.log(`[Delete Legacy] Deleted ${deleted}/${snapshot.size} documents from ${collectionName}`);
      }

      console.log(`[Delete Legacy] Successfully deleted all documents from ${collectionName}`);
    } catch (error) {
      console.error(`[Delete Legacy] Error deleting collection ${collectionName}:`, error);
    }
  }

  console.log("[Delete Legacy] Deletion complete!");
  console.log("[Delete Legacy] Note: Collections themselves will remain empty in Firestore.");
  console.log("[Delete Legacy] You can manually delete empty collections from Firebase Console if desired.");
}

// Confirmation prompt
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question(
  "⚠️  WARNING: This will delete ALL documents from 'emails', 'tasks', and 'inboxRules' collections.\n" +
  "Make sure you have verified that all data has been migrated to the new structure (users/{uid}/...).\n" +
  "Type 'DELETE' to confirm: ",
  (answer: string) => {
    rl.close();
    if (answer === "DELETE") {
      deleteLegacyCollections()
        .then(() => {
          console.log("[Delete Legacy] Done");
          process.exit(0);
        })
        .catch((error) => {
          console.error("[Delete Legacy] Fatal error:", error);
          process.exit(1);
        });
    } else {
      console.log("[Delete Legacy] Cancelled. No data was deleted.");
      process.exit(0);
    }
  }
);

