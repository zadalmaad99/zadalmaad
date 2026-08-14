// Role-system test tool: creates 4 teacher (admin) accounts and 20 student
// accounts (5 students per teacher, evenly split), then writes one test
// record to every section/branch (hifz, qiraah, murajaah, curriculum/hadith,
// attendance, curriculum listening, khatm) for each student, to verify all
// sections work and data is correctly scoped by adminId. All accounts are
// clearly tagged (name starts with TEST_) so they're easy to remove later
// via the cleanupTestStudents.js script (after updating it to also cover
// test admins/ accounts), or simply by deleting the teacher from the
// superadmin dashboard, which automatically cascades to all their students
// and records.
//
// Usage (from inside the server folder):
//   1. Place serviceAccountKey.json inside the server folder (as with the
//      other scripts)
//   2. Run: node scripts/seedRoleTest.js

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

// Every section and branch in the app is tested by writing one record per student
async function seedSectionsForStudent(student) {
  const { uid: studentId, adminId } = student;
  const createdAt = Date.now();
  const results = {};

  // Quran: hifz / qiraah / murajaah
  for (const type of ["hifz", "qiraah", "murajaah"]) {
    try {
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
        date: new Date(createdAt).toISOString().slice(0, 10),
        isLoadTest: true,
      });
      results[`records:${type}`] = "ok";
    } catch (err) {
      results[`records:${type}`] = `fail: ${err.message}`;
    }
  }

  // Curriculum (formerly "hadith")
  try {
    await adminDb.collection("hadithRecords").add({
      studentId,
      adminId,
      type: "hifz",
      book: "bulugh",
      bookName: "بلوغ المرام",
      hadithNumber: 1,
      date: new Date(createdAt).toISOString().slice(0, 10),
      isLoadTest: true,
    });
    results["hadithRecords"] = "ok";
  } catch (err) {
    results["hadithRecords"] = `fail: ${err.message}`;
  }

  // Attendance
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

  // Khatm
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

  // Curriculum listening (study-plan audio)
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
  console.log(`Creating ${ADMIN_COUNT} teachers and ${STUDENT_COUNT} students (${STUDENTS_PER_ADMIN} per teacher)...`);

  const admins = [];
  for (let i = 1; i <= ADMIN_COUNT; i++) {
    try {
      const a = await createAdmin(i);
      admins.push(a);
      console.log(`✓ Teacher ${i}: ${a.email}`);
    } catch (err) {
      console.log(`✗ Failed to create teacher ${i}: ${err.message}`);
    }
  }

  if (admins.length === 0) {
    console.error("No teacher was created, stopping.");
    process.exit(1);
  }

  const students = [];
  let studentIndex = 1;
  for (const admin of admins) {
    for (let j = 0; j < STUDENTS_PER_ADMIN; j++) {
      try {
        const s = await createStudent(studentIndex, admin.uid);
        students.push(s);
        console.log(`  ✓ Student ${studentIndex} -> teacher ${admin.email}`);
      } catch (err) {
        console.log(`  ✗ Failed to create student ${studentIndex}: ${err.message}`);
      }
      studentIndex++;
    }
  }

  console.log(`\nTesting writes across all sections for each student (${students.length} students)...`);
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

  console.log("=== Final result ===");
  console.log(`Teachers: ${admins.length}/${ADMIN_COUNT} succeeded`);
  console.log(`Students: ${students.length}/${STUDENT_COUNT} succeeded`);
  console.log("Sections:");
  for (const [section, tally] of Object.entries(sectionTally)) {
    console.log(
      `  ${section}: succeeded ${tally.ok}/${tally.ok + tally.fail}` +
        (tally.fail > 0 ? `  — errors: ${tally.errors.slice(0, 2).join(" | ")}` : "")
    );
  }

  const outPath = join(__dirname, "roletest-accounts.json");
  const fs = await import("fs/promises");
  await fs.writeFile(outPath, JSON.stringify({ admins, students }, null, 2));
  console.log(`\nAccount data saved (for review or manual login) to: ${outPath}`);
  console.log(
    "To delete all these accounts later: delete each test teacher from (Supervision Dashboard -> Delete Teacher) in the app, which automatically cascades to all their students and records."
  );
})();
