import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../firebaseAdmin.js";
import { requireAdmin } from "../adminAuth.js";
import { asyncHandler } from "../asyncHandler.js";

const router = Router();

const TYPES = ["hifz", "qiraah", "murajaah"];

function validatePayload(body) {
  const { type, studentId, book, bookName, hadithNumber, date, notes } = body || {};
  if (!TYPES.includes(type)) return null;
  if (!studentId || !book || !hadithNumber || !date) return null;

  return {
    type,
    studentId,
    book,
    bookName: bookName || "",
    hadithNumber: Number(hadithNumber),
    date,
    notes: (notes || "").trim(),
  };
}

function historyEntry(payload) {
  return {
    date: payload.date,
    hadithNumber: payload.hadithNumber,
    at: Date.now(),
  };
}

router.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = validatePayload(req.body);
    if (!payload) return res.status(400).json({ error: "invalid hadith record payload" });

    const ref = await adminDb.collection("hadithRecords").add({
      ...payload,
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
    if (!payload) return res.status(400).json({ error: "invalid hadith record payload" });

    const ref = adminDb.collection("hadithRecords").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "record not found" });
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
    await adminDb.collection("hadithRecords").doc(req.params.id).delete();
    res.json({ ok: true });
  })
);

export default router;
