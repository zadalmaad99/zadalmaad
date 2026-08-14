import { Router } from "express";
import { adminAuth, adminDb } from "../firebaseAdmin.js";
import { asyncHandler } from "../asyncHandler.js";

const router = Router();

// Public route: the account was just created client-side via Firebase
// Auth, so there's no existing admin/role yet to gate this behind —
// this call itself is what grants the "admin" role, once, per account.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: "missing bearer token" });

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      return res.status(401).json({ error: "invalid token" });
    }

    const { name, contactType, contactValue } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: "invalid name" });

    const existing = await adminDb.collection("users").doc(decoded.uid).get();
    if (existing.exists) {
      return res.status(409).json({ error: "account already has a role" });
    }

    const createdAt = Date.now();
    const batch = adminDb.batch();
    batch.set(adminDb.collection("users").doc(decoded.uid), {
      role: "admin",
      loginEmail: decoded.email,
      createdAt,
    });
    batch.set(adminDb.collection("admins").doc(decoded.uid), {
      name: name.trim(),
      contactType: contactType === "phone" ? "phone" : "email",
      contactValue: (contactValue || "").trim(),
      loginEmail: decoded.email,
      createdAt,
    });
    await batch.commit();
    res.status(201).json({ ok: true });
  })
);

export default router;
