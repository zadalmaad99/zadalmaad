// يعيد كتابة سجلات القرآن (records) والمنهج (hadithRecords) للطلاب
// التجريبيين العشرين الذين أنشأهم seedRoleTest.js سابقًا، بالشكل
// الصحيح المطابق لما يتوقعه التطبيق (حقل type بدل domain). يُستخدم
// بعد أن تبيّن أن seedRoleTest.js كان يكتب حقلًا خاطئًا جعل صفحة
// "العام" تظهر فارغة رغم وجود السجلات. لا يُنشئ أي حسابات جديدة،
// فقط يحذف السجلات القديمة الخاطئة (المعلَّمة isLoadTest:true) لهؤلاء
// الطلاب ويكتبها من جديد بالشكل الصحيح.
//
// الاستخدام (من داخل مجلد server):
//   1. ضع serviceAccountKey.json داخل مجلد server
//   2. شغّل: node scripts/fixRoleTestRecords.js

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
  console.error(`تعذّر قراءة ملف مفتاح الخدمة في: ${keyPath}`);
  process.exit(1);
}

let accounts;
try {
  accounts = JSON.parse(readFileSync(accountsPath, "utf8"));
} catch {
  console.error(
    `تعذّر قراءة ${accountsPath}\nشغّل seedRoleTest.js أولًا لإنشاء الحسابات.`
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
  console.log(`إعادة تهيئة سجلات ${accounts.students.length} طالب تجريبي...`);
  let totalRemoved = 0;
  for (const student of accounts.students) {
    const { removedRecords, removedHadith } = await reseedStudent(student);
    totalRemoved += removedRecords + removedHadith;
    process.stdout.write(".");
  }
  console.log(`\nتم. حُذف ${totalRemoved} سجل قديم خاطئ، وأُضيف 4 سجلات صحيحة لكل طالب.`);
})();
