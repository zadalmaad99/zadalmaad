import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../firebaseAdmin.js";
import { requireAdmin } from "../adminAuth.js";

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

router.post("/", requireAdmin, async (req, res) => {
  const payload = validatePayload(req.body);
  if (!payload) return res.status(400).json({ error: "invalid record payload" });

  const ref = await adminDb.collection("records").add({
    ...payload,
    history: [historyEntry(payload)],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });
  res.status(201).json({ id: ref.id });
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const payload = validatePayload(req.body);
  if (!payload) return res.status(400).json({ error: "invalid record payload" });

  await adminDb
    .collection("records")
    .doc(req.params.id)
    .update({
      ...payload,
      history: FieldValue.arrayUnion(historyEntry(payload)),
      updatedAt: Date.now(),
    });
  res.json({ ok: true });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  await adminDb.collection("records").doc(req.params.id).delete();
  res.json({ ok: true });
});

export default router;
