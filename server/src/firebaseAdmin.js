import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!raw) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_JSON environment variable");
}

const serviceAccount = JSON.parse(
  raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")
);

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();
