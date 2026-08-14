// يحذف كل الحسابات التي أنشأها bulkCreateTestStudents.js (المعلَّمة
// isLoadTest: true) من Firebase Auth و Firestore معًا.
//
// الاستخدام (من داخل مجلد server):
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
  console.error(`تعذّر قراءة ملف مفتاح الخدمة في: ${keyPath}`);
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
    console.log("لا توجد حسابات تجريبية لحذفها.");
    return;
  }

  console.log(`وجدت ${snap.size} حساب تجريبي، جارٍ الحذف...`);
  let done = 0;
  for (const doc of snap.docs) {
    const uid = doc.id;
    try {
      await adminAuth.deleteUser(uid);
    } catch {
      // قد يكون الحساب محذوفًا من Auth مسبقًا، نكمل حذف بيانات Firestore على أي حال
    }
    const batch = adminDb.batch();
    batch.delete(adminDb.collection("students").doc(uid));
    batch.delete(adminDb.collection("users").doc(uid));
    await batch.commit();
    done += 1;
    process.stdout.write(`\r${done}/${snap.size}`);
  }
  console.log("\nتم حذف كل الحسابات التجريبية.");
})();
