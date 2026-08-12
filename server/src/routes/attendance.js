import { Router } from "express";
import { adminDb } from "../firebaseAdmin.js";
import { requireAdmin } from "../adminAuth.js";
import { asyncHandler } from "../asyncHandler.js";

const router = Router();

const STATUSES = ["present", "absent", "excused"];

function validatePayload(body) {
  const { studentId, date, status, notes } = body || {};
  if (!studentId || !date || !STATUSES.includes(status)) return null;
  return {
    studentId,
    date,
    status,
    notes: (notes || "").trim(),
  };
}

router.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const payload = validatePayload(req.body);
    if (!payload) return res.status(400).json({ error: "invalid attendance payload" });

    const ref = await adminDb.collection("attendance").add({
      ...payload,
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
    if (!payload) return res.status(400).json({ error: "invalid attendance payload" });

    const ref = adminDb.collection("attendance").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "attendance record not found" });
    }

    await ref.update({ ...payload, updatedAt: Date.now() });
    res.json({ ok: true });
  })
);

router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    await adminDb.collection("attendance").doc(req.params.id).delete();
    res.json({ ok: true });
  })
);

export default router;
