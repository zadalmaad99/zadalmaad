import { Router } from "express";
import { adminDb } from "../firebaseAdmin.js";
import { requireAdmin } from "../adminAuth.js";
import { asyncHandler } from "../asyncHandler.js";
import { getStudentAdminId, ownsResource } from "../ownership.js";

const router = Router();

const RESETTABLE_TYPES = ["qiraah", "murajaah"];

router.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { studentId, type } = req.body || {};
    if (!studentId || !RESETTABLE_TYPES.includes(type)) {
      return res.status(400).json({ error: "invalid khatm payload" });
    }

    const studentAdminId = await getStudentAdminId(studentId);
    if (!ownsResource(req, studentAdminId)) {
      return res.status(403).json({ error: "not authorized" });
    }

    const existingSnap = await adminDb
      .collection("khatmat")
      .where("studentId", "==", studentId)
      .where("type", "==", type)
      .get();
    const khatmNumber = existingSnap.size + 1;

    const recordsSnap = await adminDb
      .collection("records")
      .where("studentId", "==", studentId)
      .where("type", "==", type)
      .get();

    const batch = adminDb.batch();
    batch.set(adminDb.collection("khatmat").doc(), {
      studentId,
      type,
      khatmNumber,
      adminId: studentAdminId,
      date: new Date().toISOString().slice(0, 10),
      createdAt: Date.now(),
    });
    recordsSnap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    res.status(201).json({ khatmNumber });
  })
);

export default router;
