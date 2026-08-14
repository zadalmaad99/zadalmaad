import { Router } from "express";
import { adminAuth, adminDb } from "../firebaseAdmin.js";
import { requireAdmin } from "../adminAuth.js";
import { asyncHandler } from "../asyncHandler.js";
import { normalizePhoneDigits } from "../phone.js";

const router = Router();

const PHONE_DOMAIN = "phone.quran-tracker.app";

function resolveIdentifier(body) {
  const contactType = body.contactType === "phone" ? "phone" : "email";
  const contactValue = (body.contactValue || "").trim();
  if (!contactValue) return null;

  const loginEmail =
    contactType === "phone"
      ? `${normalizePhoneDigits(contactValue)}@${PHONE_DOMAIN}`
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
        adminId: req.adminUid,
        createdAt,
      });
      batch.set(adminDb.collection("users").doc(userRecord.uid), {
        role: "student",
        loginEmail: identifier.loginEmail,
        adminId: req.adminUid,
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
    if (!req.isSuperadmin && snap.data().adminId !== req.adminUid) {
      return res.status(403).json({ error: "not authorized" });
    }
    await ref.update(update);
    res.json({ ok: true });
  })
);

const CASCADE_COLLECTIONS = [
  "records",
  "hadithRecords",
  "attendance",
  "khatmat",
  "listeningProgress",
];

// Deletes every doc in `collection` where studentId == id, chunked to
// stay under Firestore's 500-operation batch limit.
async function deleteWhereStudent(collection, studentId) {
  const snap = await adminDb
    .collection(collection)
    .where("studentId", "==", studentId)
    .get();
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 450) {
    const batch = adminDb.batch();
    docs.slice(i, i + 450).forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
  return docs.length;
}

router.delete(
  "/:id",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const studentId = req.params.id;
    const ref = adminDb.collection("students").doc(studentId);
    const snap = await ref.get();
    if (!snap.exists) {
      return res.status(404).json({ error: "student not found" });
    }
    if (!req.isSuperadmin && snap.data().adminId !== req.adminUid) {
      return res.status(403).json({ error: "not authorized" });
    }

    // Cascade: remove every trace of this student across all tracking
    // collections first, so nothing orphaned lingers in any section.
    for (const collection of CASCADE_COLLECTIONS) {
      await deleteWhereStudent(collection, studentId);
    }

    const batch = adminDb.batch();
    batch.delete(adminDb.collection("users").doc(studentId));
    batch.delete(adminDb.collection("students").doc(studentId));
    await batch.commit();

    try {
      await adminAuth.deleteUser(studentId);
    } catch {
      // account may already be gone from Auth; Firestore cleanup above still succeeded
    }

    res.json({ ok: true });
  })
);

export default router;
