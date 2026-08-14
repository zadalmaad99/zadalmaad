// أداة اختبار نظام الأدوار: تنشئ 4 حسابات معلّمين (admin) و20 حساب طالب
// (5 طلاب لكل معلّم بالتساوي)، ثم تكتب سجلاً تجريبيًا في كل قسم/فرع
// (حفظ، قراءة، مراجعة، المنهج/الحديث، الحضور، الاستماع للمنهج، ختمة)
// لكل طالب، للتحقق من أن كل الأقسام تعمل وأن البيانات تُعزل بشكل صحيح
// حسب adminId. كل الحسابات تُعلَّم بوضوح (name يبدأ بـ TEST_) ليسهل
// حذفها لاحقًا بسكربت cleanupTestStudents.js (بعد تعديله ليشمل أيضًا
// حسابات admins/ التجريبية، أو حذفها يدويًا عبر حذف المعلم من لوحة
// السوبرادمن، الذي يحذف تلقائيًا كل طلابه وسجلاتهم).
//
// الاستخدام (من داخل مجلد server):
//   1. ضع serviceAccountKey.json داخل مجلد server (كما في السكربتات الأخرى)
//   2. شغّل: node scripts/seedRoleTest.js

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

const ADMIN_COUNT = 4;
const STUDENT_COUNT = 20;
const STUDENTS_PER_ADMIN = STUDENT_COUNT / ADMIN_COUNT;

function randomPassword() {
  return crypto.randomBytes(9).toString("base64url");
}

async function createAdmin(i) {
  const suffix = crypto.randomBytes(4).toString("hex");
  const email = `test_admin_${i}_${suffix}@test.zad-almaad.local`;
  const password = randomPassword();
  const userRecord = await adminAuth.createUser({ email, password });
  const createdAt = Date.now();
  const batch = adminDb.batch();
  batch.set(adminDb.collection("users").doc(userRecord.uid), {
    role: "admin",
    loginEmail: email,
    createdAt,
    isLoadTest: true,
  });
  batch.set(adminDb.collection("admins").doc(userRecord.uid), {
    name: `TEST_ADMIN_${i}`,
    contactType: "email",
    contactValue: email,
    loginEmail: email,
    createdAt,
    isLoadTest: true,
  });
  await batch.commit();
  return { uid: userRecord.uid, email, password };
}

async function createStudent(i, adminId) {
  const suffix = crypto.randomBytes(4).toString("hex");
  const email = `test_student_${i}_${suffix}@test.zad-almaad.local`;
  const password = randomPassword();
  const userRecord = await adminAuth.createUser({ email, password });
  const createdAt = Date.now();
  const batch = adminDb.batch();
  batch.set(adminDb.collection("students").doc(userRecord.uid), {
    name: `TEST_STUDENT_${String(i).padStart(2, "0")}`,
    contactType: "email",
    contactValue: email,
    loginEmail: email,
    adminId,
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
  return { uid: userRecord.uid, email, password, adminId };
}

// كل قسم وفرع في التطبيق يُختبر بكتابة سجل واحد لكل طالب
async function seedSectionsForStudent(student) {
  const { uid: studentId, adminId } = student;
  const createdAt = Date.now();
  const results = {};

  // القرآن: حفظ / قراءة / مراجعة
  for (const domain of ["hifz", "qiraah", "murajaah"]) {
    try {
      await adminDb.collection("records").add({
        studentId,
        adminId,
        domain,
        surah: 1,
        ayahFrom: 1,
        ayahTo: 7,
        date: createdAt,
        isLoadTest: true,
      });
      results[`records:${domain}`] = "ok";
    } catch (err) {
      results[`records:${domain}`] = `fail: ${err.message}`;
    }
  }

  // المنهج (الحديث سابقًا)
  try {
    await adminDb.collection("hadithRecords").add({
      studentId,
      adminId,
      book: "بلوغ المرام",
      hadithNumber: 1,
      date: createdAt,
      isLoadTest: true,
    });
    results["hadithRecords"] = "ok";
  } catch (err) {
    results["hadithRecords"] = `fail: ${err.message}`;
  }

  // الحضور
  try {
    await adminDb.collection("attendance").add({
      studentId,
      adminId,
      status: "present",
      date: createdAt,
      isLoadTest: true,
    });
    results["attendance"] = "ok";
  } catch (err) {
    results["attendance"] = `fail: ${err.message}`;
  }

  // ختمة
  try {
    await adminDb.collection("khatmat").add({
      studentId,
      adminId,
      date: createdAt,
      isLoadTest: true,
    });
    results["khatmat"] = "ok";
  } catch (err) {
    results["khatmat"] = `fail: ${err.message}`;
  }

  // الاستماع للمنهج (دراسة الكتب بالتدريج)
  try {
    await adminDb.collection("listeningProgress").add({
      studentId,
      adminId,
      book: "التوحيد",
      sheikh: "اختبار",
      progressPercent: 50,
      downloaded: false,
      replayCount: 0,
      date: createdAt,
      isLoadTest: true,
    });
    results["listeningProgress"] = "ok";
  } catch (err) {
    results["listeningProgress"] = `fail: ${err.message}`;
  }

  return results;
}

(async () => {
  console.log(`إنشاء ${ADMIN_COUNT} معلّمين و${STUDENT_COUNT} طالب (${STUDENTS_PER_ADMIN} لكل معلّم)...`);

  const admins = [];
  for (let i = 1; i <= ADMIN_COUNT; i++) {
    try {
      const a = await createAdmin(i);
      admins.push(a);
      console.log(`✓ معلّم ${i}: ${a.email}`);
    } catch (err) {
      console.log(`✗ فشل إنشاء معلّم ${i}: ${err.message}`);
    }
  }

  if (admins.length === 0) {
    console.error("لم يُنشأ أي معلّم، توقف.");
    process.exit(1);
  }

  const students = [];
  let studentIndex = 1;
  for (const admin of admins) {
    for (let j = 0; j < STUDENTS_PER_ADMIN; j++) {
      try {
        const s = await createStudent(studentIndex, admin.uid);
        students.push(s);
        console.log(`  ✓ طالب ${studentIndex} -> معلّم ${admin.email}`);
      } catch (err) {
        console.log(`  ✗ فشل إنشاء طالب ${studentIndex}: ${err.message}`);
      }
      studentIndex++;
    }
  }

  console.log(`\nاختبار الكتابة في كل الأقسام لكل طالب (${students.length} طالب)...`);
  const sectionTally = {};
  for (const student of students) {
    const results = await seedSectionsForStudent(student);
    for (const [section, outcome] of Object.entries(results)) {
      sectionTally[section] = sectionTally[section] || { ok: 0, fail: 0, errors: [] };
      if (outcome === "ok") sectionTally[section].ok++;
      else {
        sectionTally[section].fail++;
        sectionTally[section].errors.push(outcome);
      }
    }
    process.stdout.write(".");
  }
  console.log("\n");

  console.log("=== النتيجة النهائية ===");
  console.log(`المعلّمون: ${admins.length}/${ADMIN_COUNT} نجح`);
  console.log(`الطلاب: ${students.length}/${STUDENT_COUNT} نجح`);
  console.log("الأقسام:");
  for (const [section, tally] of Object.entries(sectionTally)) {
    console.log(
      `  ${section}: نجح ${tally.ok}/${tally.ok + tally.fail}` +
        (tally.fail > 0 ? `  — أخطاء: ${tally.errors.slice(0, 2).join(" | ")}` : "")
    );
  }

  const outPath = join(__dirname, "roletest-accounts.json");
  const fs = await import("fs/promises");
  await fs.writeFile(outPath, JSON.stringify({ admins, students }, null, 2));
  console.log(`\nتم حفظ بيانات الحسابات (للمراجعة أو تسجيل الدخول اليدوي) في: ${outPath}`);
  console.log(
    "لحذف كل هذه الحسابات لاحقًا: احذف كل معلّم تجريبي من (لوحة الإشراف -> حذف المعلم) في التطبيق، فيُحذف معه كل طلابه وسجلاتهم تلقائيًا."
  );
})();
