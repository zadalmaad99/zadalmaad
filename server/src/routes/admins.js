import { Router } from "express";
import { adminAuth, adminDb } from "../firebaseAdmin.js";
import { requireSuperadmin } from "../adminAuth.js";
import { asyncHandler } from "../asyncHandler.js";

const STUDENT_CASCADE_COLLECTIONS = [
  "records",
  "hadithRecords",
  "attendance",
  "khatmat",
  "listeningProgress",
];

async function deleteWhereField(collection, field, value) {
  const snap = await adminDb.collection(collection).where(field, "==", value).get();
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = adminDb.batch();
    docs.slice(i, i + 450).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  return docs;
}

const router = Router();

async function countWhere(collection, field, value) {
  const snap = await adminDb.collection(collection).where(field, "==", value).count().get();
  return snap.data().count;
}

router.get(
  "/",
  requireSuperadmin,
  asyncHandler(async (req, res) => {
    const usersSnap = await adminDb.collection("users").where("role", "==", "admin").get();

    const admins = await Promise.all(
      usersSnap.docs.map(async (userDoc) => {
        const uid = userDoc.id;
        const profileSnap = await adminDb.collection("admins").doc(uid).get();
        const profile = profileSnap.exists ? profileSnap.data() : {};

        const [studentCount, recordCount, hadithRecordCount, attendanceCount] =
          await Promise.all([
            countWhere("students", "adminId", uid),
            countWhere("records", "adminId", uid),
            countWhere("hadithRecords", "adminId", uid),
            countWhere("attendance", "adminId", uid),
          ]);

        return {
          id: uid,
          name: profile.name || "—",
          contactType: profile.contactType || "email",
          contactValue: profile.contactValue || profile.loginEmail || "",
          createdAt: profile.createdAt || userDoc.data().createdAt || null,
          studentCount,
          activityCount: recordCount + hadithRecordCount + attendanceCount,
        };
      })
    );

    admins.sort((a, b) => b.activityCount - a.activityCount);
    res.json({ admins });
  })
);

router.delete(
  "/:id",
  requireSuperadmin,
  asyncHandler(async (req, res) => {
    const adminId = req.params.id;

    const studentDocs = await deleteWhereField("students", "adminId", adminId);
    for (const studentDoc of studentDocs) {
      for (const collection of STUDENT_CASCADE_COLLECTIONS) {
        await deleteWhereField(collection, "studentId", studentDoc.id);
      }
      try {
        await adminAuth.deleteUser(studentDoc.id);
      } catch {
        // already gone from Auth; Firestore cleanup still proceeds
      }
    }
    // students collection docs + their users/{uid} allow-list docs
    const batch1 = adminDb.batch();
    studentDocs.forEach((doc) => {
      batch1.delete(adminDb.collection("users").doc(doc.id));
    });
    if (studentDocs.length) await batch1.commit();

    await adminDb.collection("admins").doc(adminId).delete();
    await adminDb.collection("users").doc(adminId).delete();
    try {
      await adminAuth.deleteUser(adminId);
    } catch {
      // already gone from Auth; Firestore cleanup still proceeds
    }

    res.json({ ok: true, studentsRemoved: studentDocs.length });
  })
);

export default router;
