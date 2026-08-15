import { adminAuth, adminDb } from "./firebaseAdmin.js";

export const SUPERADMIN_EMAILS = ["mathelove2@gmail.com", "admin.zadalmaad@admin.com"];

function bearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

async function resolveRole(decoded) {
  if (SUPERADMIN_EMAILS.includes(decoded.email)) {
    return { role: "superadmin", isSuperadmin: true };
  }
  const snap = await adminDb.collection("users").doc(decoded.uid).get();
  const role = snap.exists ? snap.data().role : null;
  return { role, isSuperadmin: false };
}

// Any admin (teacher) or the superadmin. Attaches req.adminUid (the
// acting admin's own uid — used to scope student ownership) and
// req.isSuperadmin (bypasses ownership checks, sees everything).
export async function requireAdmin(req, res, next) {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: "missing bearer token" });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const { role, isSuperadmin } = await resolveRole(decoded);
    if (role !== "admin" && !isSuperadmin) {
      return res.status(403).json({ error: "not authorized" });
    }
    req.admin = decoded;
    req.adminUid = decoded.uid;
    req.isSuperadmin = isSuperadmin;
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}

// Superadmin-only routes (admin oversight/stats).
export async function requireSuperadmin(req, res, next) {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: "missing bearer token" });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!SUPERADMIN_EMAILS.includes(decoded.email)) {
      return res.status(403).json({ error: "not authorized" });
    }
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}

// Allows either any admin/superadmin, or the student writing their own
// record (identified by req.body.studentId matching the token's uid) —
// needed for listening progress, which students record themselves as
// they listen, unlike every other admin-entered tracking collection.
export async function requireSelfOrAdmin(req, res, next) {
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: "missing bearer token" });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const { role, isSuperadmin } = await resolveRole(decoded);
    const studentId = req.body?.studentId;
    if (role === "admin" || isSuperadmin || decoded.uid === studentId) {
      req.user = decoded;
      req.adminUid = decoded.uid;
      req.isSuperadmin = isSuperadmin;
      return next();
    }
    return res.status(403).json({ error: "not authorized" });
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}
