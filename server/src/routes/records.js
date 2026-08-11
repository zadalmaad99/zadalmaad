import { Router } from "express";
import { adminDb } from "../firebaseAdmin.js";
import { requireAdmin } from "../adminAuth.js";

const router = Router();

const TYPES = ["hifz", "qiraah", "murajaah"];
const UNIT_TYPES = ["surah", "juz", "hizb", "page"];

function validatePayload(body) {
  const { type, studentId, unitType, date, notes } = body || {};
  if (!TYPES.includes(type)) return null;
  if (!studentId || !date) return null;

  const resolvedUnitType = UNIT_TYPES.includes(unitType) ? unitType : "surah";
  const payload = {
    type,
    studentId,
    unitType: resolvedUnitType,
    date,
    notes: (notes || "").trim(),
  };

  if (resolvedUnitType === "surah") {
    const { surahNumber, surahName, ayahFrom, ayahTo } = body;
    if (!surahNumber || !ayahFrom || !ayahTo) return null;
    payload.surahNumber = Number(surahNumber);
    payload.surahName = surahName || "";
    payload.ayahFrom = Number(ayahFrom);
    payload.ayahTo = Number(ayahTo);
  } else if (resolvedUnitType === "juz") {
    if (!body.juzNumber) return null;
    payload.juzNumber = Number(body.juzNumber);
  } else if (resolvedUnitType === "hizb") {
    if (!body.hizbNumber) return null;
    payload.hizbNumber = Number(body.hizbNumber);
  } else if (resolvedUnitType === "page") {
    if (!body.pageFrom || !body.pageTo) return null;
    payload.pageFrom = Number(body.pageFrom);
    payload.pageTo = Number(body.pageTo);
  }

  return payload;
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
