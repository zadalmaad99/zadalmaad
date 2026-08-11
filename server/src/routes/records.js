import { Router } from "express";
import { adminDb } from "../firebaseAdmin.js";
import { requireAdmin } from "../adminAuth.js";

const router = Router();

const TYPES = ["hifz", "qiraah", "murajaah"];

function validatePayload(body) {
  const { type, studentId, surahNumber, surahName, ayahFrom, ayahTo, date, notes } =
    body || {};
  if (!TYPES.includes(type)) return null;
  if (!studentId || !surahNumber || !ayahFrom || !ayahTo || !date) return null;
  return {
    type,
    studentId,
    surahNumber: Number(surahNumber),
    surahName: surahName || "",
    ayahFrom: Number(ayahFrom),
    ayahTo: Number(ayahTo),
    date,
    notes: (notes || "").trim(),
  };
}

router.post("/", requireAdmin, async (req, res) => {
  const payload = validatePayload(req.body);
  if (!payload) return res.status(400).json({ error: "invalid record payload" });

  const ref = await adminDb.collection("records").add({
    ...payload,
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
    .update({ ...payload, updatedAt: Date.now() });
  res.json({ ok: true });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  await adminDb.collection("records").doc(req.params.id).delete();
  res.json({ ok: true });
});

export default router;
