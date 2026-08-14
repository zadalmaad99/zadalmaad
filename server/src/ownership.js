import { adminDb } from "./firebaseAdmin.js";

// Looks up which admin owns a given student, for stamping new records.
export async function getStudentAdminId(studentId) {
  const snap = await adminDb.collection("students").doc(studentId).get();
  return snap.exists ? snap.data().adminId : null;
}

// True if the acting admin (req.adminUid) is allowed to touch a
// resource owned by resourceAdminId — superadmin always can.
export function ownsResource(req, resourceAdminId) {
  return req.isSuperadmin || resourceAdminId === req.adminUid;
}
