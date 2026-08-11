import { Router } from "express";
import { adminAuth, adminDb } from "../firebaseAdmin.js";
import { requireAdmin } from "../adminAuth.js";

const router = Router();

router.post("/", requireAdmin, async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
    return res.status(400).json({ error: "invalid name, email, or password" });
  }

  try {
    const userRecord = await adminAuth.createUser({
      email: email.trim(),
      password,
    });
    const createdAt = Date.now();
    const batch = adminDb.batch();
    batch.set(adminDb.collection("students").doc(userRecord.uid), {
      name: name.trim(),
      email: email.trim(),
      createdAt,
    });
    batch.set(adminDb.collection("users").doc(userRecord.uid), {
      role: "student",
      email: email.trim(),
      createdAt,
    });
    await batch.commit();
    res.status(201).json({ id: userRecord.uid });
  } catch (err) {
    if (err.code === "auth/email-already-exists") {
      return res.status(409).json({ error: "email already in use" });
    }
    res.status(500).json({ error: "failed to create student" });
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const { name } = req.body || {};
  if (!name?.trim()) {
    return res.status(400).json({ error: "invalid name" });
  }
  await adminDb.collection("students").doc(req.params.id).update({
    name: name.trim(),
  });
  res.json({ ok: true });
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const batch = adminDb.batch();
  batch.delete(adminDb.collection("users").doc(req.params.id));
  batch.delete(adminDb.collection("students").doc(req.params.id));
  await batch.commit();
  res.json({ ok: true });
});

export default router;
