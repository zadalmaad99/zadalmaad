// Load-test tool: creates a number of fake student accounts (random email +
// random password) in the same real Firebase project, purely to test server
// load. Each account is clearly tagged (name starts with TEST_ and
// isLoadTest:true) so it can easily be deleted later with the companion
// cleanupTestStudents.js script.
//
// Usage (from inside the server folder):
//   1. Download the service account key from Firebase Console:
//      Project Settings -> Service Accounts -> Generate new private key
//   2. Save the file as serviceAccountKey.json inside the server folder
//      (this exact name is auto-excluded from git, it will never be pushed
//      anywhere)
//   3. Run: node scripts/bulkCreateTestStudents.js 1000
//
// Only run this script from your own machine, and never share the key file with anyone.

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, "..", "serviceAccountKey.json");

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
} catch {
  console.error(
    `Could not read the service account key file at: ${keyPath}\n` +
      "Download it from Firebase Console -> Project Settings -> Service Accounts and save it with this exact name."
  );
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const adminAuth = getAuth();
const adminDb = getFirestore();

const count = Number(process.argv[2]);
if (!count || count < 1 || count > 5000) {
  console.error("Usage: node scripts/bulkCreateTestStudents.js <account count, 1-5000>");
  process.exit(1);
}

const BATCH_SIZE = 20; // create accounts in small parallel batches instead of all at once

function randomPassword() {
  return crypto.randomBytes(9).toString("base64url"); // ~12 characters
}

async function createOne(i) {
  const suffix = crypto.randomBytes(4).toString("hex");
  const email = `loadtest_${i}_${suffix}@test.zad-almaad.local`;
  const password = randomPassword();
  try {
    const userRecord = await adminAuth.createUser({ email, password });
    const createdAt = Date.now();
    const batch = adminDb.batch();
    batch.set(adminDb.collection("students").doc(userRecord.uid), {
      name: `TEST_${String(i).padStart(4, "0")}`,
      contactType: "email",
      contactValue: email,
      loginEmail: email,
      createdAt,
      isLoadTest: true,
    });
    batch.set(adminDb.collection("users").doc(userRecord.uid), {
      role: "student",
      loginEmail: email,
      createdAt,
      isLoadTest: true,
    });
    await batch.commit();
    return { ok: true, email, password, uid: userRecord.uid };
  } catch (err) {
    return { ok: false, email, error: err.message };
  }
}

(async () => {
  console.log(`Creating ${count} test accounts...`);
  const results = [];
  for (let start = 0; start < count; start += BATCH_SIZE) {
    const batchIndexes = Array.from(
      { length: Math.min(BATCH_SIZE, count - start) },
      (_, k) => start + k + 1
    );
    const batchResults = await Promise.all(batchIndexes.map(createOne));
    results.push(...batchResults);
    process.stdout.write(`\r${results.length}/${count}`);
  }
  console.log("");

  const okResults = results.filter((r) => r.ok);
  const failResults = results.filter((r) => !r.ok);
  console.log(`Succeeded: ${okResults.length}  Failed: ${failResults.length}`);
  if (failResults.length > 0) {
    console.log("First 5 errors:", failResults.slice(0, 5));
  }

  const outPath = join(__dirname, "loadtest-accounts.json");
  const fs = await import("fs/promises");
  await fs.writeFile(outPath, JSON.stringify(okResults, null, 2));
  console.log(`Account data saved to: ${outPath}`);
})();
