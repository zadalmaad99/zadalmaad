// Deletes every account created by bulkCreateTestStudents.js (tagged
// isLoadTest: true) from both Firebase Auth and Firestore.
//
// Usage (from inside the server folder):
//   node scripts/cleanupTestStudents.js

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, "..", "serviceAccountKey.json");

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
} catch {
  console.error(`Could not read the service account key file at: ${keyPath}`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const adminAuth = getAuth();
const adminDb = getFirestore();

(async () => {
  const snap = await adminDb
    .collection("students")
    .where("isLoadTest", "==", true)
    .get();

  if (snap.empty) {
    console.log("No test accounts to delete.");
    return;
  }

  console.log(`Found ${snap.size} test accounts, deleting...`);
  let done = 0;
  for (const doc of snap.docs) {
    const uid = doc.id;
    try {
      await adminAuth.deleteUser(uid);
    } catch {
      // account may already be gone from Auth; continue deleting Firestore data anyway
    }
    const batch = adminDb.batch();
    batch.delete(adminDb.collection("students").doc(uid));
    batch.delete(adminDb.collection("users").doc(uid));
    await batch.commit();
    done += 1;
    process.stdout.write(`\r${done}/${snap.size}`);
  }
  console.log("\nAll test accounts deleted.");
})();
