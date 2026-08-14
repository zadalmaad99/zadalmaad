import { Router } from "express";
import { adminDb } from "../firebaseAdmin.js";
import { requireSuperadmin } from "../adminAuth.js";
import { asyncHandler } from "../asyncHandler.js";

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

export default router;
