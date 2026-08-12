import { Router } from "express";
import { adminAuth, adminDb } from "../firebaseAdmin.js";
import { requireAdmin } from "../adminAuth.js";
import { asyncHandler } from "../asyncHandler.js";

const router = Router();

const PHONE_DOMAIN = "phone.quran-tracker.app";

function resolveIdentifier(body) {
  const contactType = body.contactType === "phone" ? "phone" : "email";
  const contactValue = (body.contactValue || "").trim();
  if (!contactValue) return null;

  const loginEmail =
    contactType === "phone"
      ? `${contactValue.replace(/[^\d]/g, "")}@${PHONE_DOMAIN}`
      : contactValue;

  return { contactType, contactValue, loginEmail };
}

router.post(
  "/",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name, password } = req.body || {};
    const identifier = resolveIdentifier(req.body || {});
    if (!name?.trim() || !identifier || !password || password.length < 6) {
      return res
        .status(400)
        .json({ error: "invalid name, contact info, or password" });
    }

    try {
      const userRecord = await adminAuth.createUser({
        email: identifier.loginEmail,
        password,
      });
      const createdAt = Date.now();
      const batch = adminDb.batch();
      batch.set(adminDb.collection("students").doc(userRecord.uid), {
        name: name.trim(),
        contactType: identifier.contactType,
        contactValue: identifier.contactValue,
        loginEmail: identifier.loginEmail,
        createdAt,
      });
      batch.set(adminDb.collection("users").doc(userRecord.uid), {
        role: "student",
        loginEmail: identifier.loginEmail,
        createdAt,
      });
      await batch.commit();
      res.status(201).json({ id: userRecord.uid });
    } catch (err) {
      if (err.code === "auth/email-already-exists") {
        return res.status(409).json({ error: "email already in use" });
      }
      throw err;
    }
  })
);

router.patch(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const { name } = req.body || {};
    if (!name?.trim()) {
      return res.status(400).json({ error: "invalid name" });
    }
    const identifier = resolveIdentifier(req.body || {});
    const update = { name: name.trim() };
    if (identifier) {
      update.contactType = identifier.contactType;
      update.contactValue = identifier.contactValue;
    }

    const ref = adminDb.collection("students").doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "student not found" });
    }
    await ref.update(update);
    res.json({ ok: true });
  })
);

router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const batch = adminDb.batch();
    batch.delete(adminDb.collection("users").doc(req.params.id));
    batch.delete(adminDb.collection("students").doc(req.params.id));
    await batch.commit();
    res.json({ ok: true });
  })
);

export default router;
