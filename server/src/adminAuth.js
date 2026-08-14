import { adminAuth } from "./firebaseAdmin.js";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean);

export async function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "missing bearer token" });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.email || !ADMIN_EMAILS.includes(decoded.email)) {
      return res.status(403).json({ error: "not authorized" });
    }
    req.admin = decoded;
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}

export function isAdminEmail(email) {
  return !!email && ADMIN_EMAILS.includes(email);
}

// Allows either the admin or the student writing their own record
// (identified by req.body.studentId matching the token's uid) — needed
// for listening progress, which students record themselves as they
// listen, unlike every other admin-entered tracking collection.
export async function requireSelfOrAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "missing bearer token" });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const studentId = req.body?.studentId;
    if (isAdminEmail(decoded.email) || decoded.uid === studentId) {
      req.user = decoded;
      return next();
    }
    return res.status(403).json({ error: "not authorized" });
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}
