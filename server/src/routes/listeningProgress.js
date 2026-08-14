import { Router } from "express";
import { adminDb } from "../firebaseAdmin.js";
import { requireSelfOrAdmin } from "../adminAuth.js";
import { asyncHandler } from "../asyncHandler.js";
import { getStudentAdminId } from "../ownership.js";

const router = Router();

function validatePayload(body) {
  const { studentId, book, sheikh, progressPercent, downloaded } = body || {};
  if (!studentId || !book || !sheikh) return null;
  const pct = Number(progressPercent);
  if (Number.isNaN(pct)) return null;

  return {
    studentId,
    book,
    sheikh,
    progressPercent: Math.max(0, Math.min(100, pct)),
    downloaded: !!downloaded,
  };
}

// Upsert: one record per studentId+book+sheikh combo, keyed via a
// deterministic doc id so repeated listens just update in place.
function docId(payload) {
  const raw = `${payload.studentId}__${payload.book}__${payload.sheikh}`;
  return Buffer.from(raw).toString("base64url");
}

router.post(
  "/",
  requireSelfOrAdmin,
  asyncHandler(async (req, res) => {
    const payload = validatePayload(req.body);
    if (!payload) return res.status(400).json({ error: "invalid listening progress payload" });

    const studentAdminId = await getStudentAdminId(payload.studentId);

    const ref = adminDb.collection("listeningProgress").doc(docId(payload));
    const snap = await ref.get();
    const existing = snap.exists ? snap.data() : null;

    await ref.set(
      {
        ...payload,
        adminId: studentAdminId,
        // never let a smaller progress value overwrite a larger one
        // (e.g. re-listening from the start shouldn't erase past progress)
        progressPercent: Math.max(payload.progressPercent, existing?.progressPercent || 0),
        downloaded: payload.downloaded || existing?.downloaded || false,
        updatedAt: Date.now(),
        createdAt: existing?.createdAt || Date.now(),
      },
      { merge: true }
    );
    res.status(200).json({ ok: true });
  })
);

export default router;
