// أداة تحميل تجريبي: تنشئ عددًا من حسابات الطلاب الوهمية (بريد عشوائي +
// كلمة مرور عشوائية) في نفس مشروع Firebase الحقيقي، لغرض اختبار تحمّل
// الخادم فقط. كل حساب يُعلَّم بوضوح (name يبدأ بـ TEST_ و isLoadTest:true)
// حتى يسهل حذفه لاحقًا بالسكربت المرافق cleanupTestStudents.js.
//
// الاستخدام (من داخل مجلد server):
//   1. حمّل مفتاح حساب الخدمة من Firebase Console:
//      Project Settings -> Service Accounts -> Generate new private key
//   2. ضع الملف باسم serviceAccountKey.json داخل مجلد server (هذا الاسم
//      مستثنى من git تلقائيًا، لن يُرفع لأي مكان)
//   3. شغّل: node scripts/bulkCreateTestStudents.js 1000
//
// لا تشغّل هذا السكربت إلا من جهازك، ولا تشارك ملف المفتاح مع أحد.

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
    `تعذّر قراءة ملف مفتاح الخدمة في: ${keyPath}\n` +
      "حمّله من Firebase Console -> Project Settings -> Service Accounts وضعه بهذا الاسم."
  );
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const adminAuth = getAuth();
const adminDb = getFirestore();

const count = Number(process.argv[2]);
if (!count || count < 1 || count > 5000) {
  console.error("الاستخدام: node scripts/bulkCreateTestStudents.js <عدد الحسابات، 1-5000>");
  process.exit(1);
}

const BATCH_SIZE = 20; // إنشاء حسابات على دفعات متوازية صغيرة بدل كلها دفعة واحدة

function randomPassword() {
  return crypto.randomBytes(9).toString("base64url"); // 12 حرفًا تقريبًا
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
  console.log(`إنشاء ${count} حساب تجريبي...`);
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
  console.log(`نجح: ${okResults.length}  فشل: ${failResults.length}`);
  if (failResults.length > 0) {
    console.log("أول 5 أخطاء:", failResults.slice(0, 5));
  }

  const outPath = join(__dirname, "loadtest-accounts.json");
  const fs = await import("fs/promises");
  await fs.writeFile(outPath, JSON.stringify(okResults, null, 2));
  console.log(`تم حفظ بيانات الحسابات في: ${outPath}`);
})();
