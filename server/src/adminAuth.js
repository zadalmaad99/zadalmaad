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
