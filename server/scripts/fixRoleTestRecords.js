// Re-writes the Quran (records) and curriculum (hadithRecords) records for
// the 20 test students previously created by seedRoleTest.js, using the
// correct shape the app expects (a "type" field, not "domain"). Used after
// discovering that seedRoleTest.js was writing the wrong field, which made
// the "Overview" page appear empty despite records existing. Creates no new
// accounts — it only deletes the old, incorrectly-shaped records (tagged
// isLoadTest:true) for these students and re-writes them correctly.
//
// Usage (from inside the server folder):
//   1. Place serviceAccountKey.json inside the server folder
//   2. Run: node scripts/fixRoleTestRecords.js

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const keyPath = join(__dirname, "..", "serviceAccountKey.json");
const accountsPath = join(__dirname, "roletest-accounts.json");

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
} catch {
  console.error(`Could not read the service account key file at: ${keyPath}`);
  process.exit(1);
}

let accounts;
try {
  accounts = JSON.parse(readFileSync(accountsPath, "utf8"));
} catch {
  console.error(
    `Could not read ${accountsPath}\nRun seedRoleTest.js first to create the accounts.`
  );
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const adminDb = getFirestore();

async function deleteOldTestDocs(collection, studentId) {
  const snap = await adminDb
    .collection(collection)
    .where("studentId", "==", studentId)
    .where("isLoadTest", "==", true)
    .get();
  if (snap.empty) return 0;
  const batch = adminDb.batch();
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
  return snap.size;
}

async function reseedStudent(student) {
  const { uid: studentId, adminId } = student;
  const today = new Date().toISOString().slice(0, 10);

  const removedRecords = await deleteOldTestDocs("records", studentId);
  const removedHadith = await deleteOldTestDocs("hadithRecords", studentId);

  for (const type of ["hifz", "qiraah", "murajaah"]) {
    await adminDb.collection("records").add({
      studentId,
      adminId,
      type,
      surahNumber: 1,
      surahName: "الفاتحة",
      ayahFrom: 1,
      ayahTo: 7,
      juz: 1,
      hizb: 1,
      page: 1,
      date: today,
      isLoadTest: true,
    });
  }

  await adminDb.collection("hadithRecords").add({
    studentId,
    adminId,
    type: "hifz",
    book: "bulugh",
    bookName: "بلوغ المرام",
    hadithNumber: 1,
    date: today,
    isLoadTest: true,
  });

  return { removedRecords, removedHadith };
}

(async () => {
  console.log(`Re-seeding records for ${accounts.students.length} test students...`);
  let totalRemoved = 0;
  for (const student of accounts.students) {
    const { removedRecords, removedHadith } = await reseedStudent(student);
    totalRemoved += removedRecords + removedHadith;
    process.stdout.write(".");
  }
  console.log(`\nDone. Removed ${totalRemoved} old incorrect records, added 4 correct records per student.`);
})();
