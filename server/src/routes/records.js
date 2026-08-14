import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../firebaseAdmin.js";
import { requireAdmin } from "../adminAuth.js";
import { asyncHandler } from "../asyncHandler.js";
import { getStudentAdminId, ownsResource } from "../ownership.js";

const router = Router();

const TYPES = ["hifz", "qiraah", "murajaah"];

function validatePayload(body) {
  const {
    type,
    studentId,
    surahNumber,
    surahName,
    ayahFrom,
    ayahTo,
    juz,
    hizb,
    page,
    date,
    notes,
  } = body || {};
  if (!TYPES.includes(type)) return null;
  if (!studentId || !surahNumber || !ayahFrom || !ayahTo || !date) return null;

  return {
    type,
    studentId,
    surahNumber: Number(surahNumber),
    surahName: surahName || "",
    ayahFrom: Number(ayahFrom),
    ayahTo: Number(ayahTo),
    juz: juz ? Number(juz) : null,
    hizb: hizb ? Number(hizb) : null,
    page: page ? Number(page) : null,
    date,
    notes: (notes || "").trim(),
  };
}

function historyEntry(payload) {
  return {
    date: payload.date,
    ayahFrom: payload.ayahFrom,
    ayahTo: payload.ayahTo,
    at: Date.now(),
  };
}

router.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = validatePayload(req.body);
    if (!payload) return res.status(400).json({ error: "invalid record payload" });

    const studentAdminId = await getStudentAdminId(payload.studentId);
    if (!ownsResource(req, studentAdminId)) {
      return res.status(403).json({ error: "not authorized" });
    }

    const ref = await adminDb.collection("records").add({
      ...payload,
      adminId: studentAdminId,
      history: [historyEntry(payload)],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    res.status(201).json({ id: ref.id });
  })
);

router.patch(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = validatePayload(req.body);
    if (!payload) return res.status(400).json({ error: "invalid record payload" });

    const ref = adminDb.collection("records").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "record not found" });
    }
    if (!ownsResource(req, snap.data().adminId)) {
      return res.status(403).json({ error: "not authorized" });
    }

    await ref.update({
      ...payload,
      history: FieldValue.arrayUnion(historyEntry(payload)),
      updatedAt: Date.now(),
    });
    res.json({ ok: true });
  })
);

router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const ref = adminDb.collection("records").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "record not found" });
    }
    if (!ownsResource(req, snap.data().adminId)) {
      return res.status(403).json({ error: "not authorized" });
    }
    await ref.delete();
    res.json({ ok: true });
  })
);

export default router;
