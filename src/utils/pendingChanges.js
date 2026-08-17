import { addDoc, collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

const OWNER_EMAIL = "mathelove2@gmail.com";
const WATCHED_EMAIL = "admin.zadalmaad@admin.com";

// The real gate: Firestore rules only let mathelove2@gmail.com write to
// curriculumAudio/curriculumOverrides/curriculumMeta directly — a write
// attempted by admin.zadalmaad@admin.com against those collections is
// rejected server-side. So when the actor is the watched superadmin, queue
// the intended write as a pendingChanges doc instead (which it *is*
// allowed to create) and wait for the owner to approve or reject it.
// Everyone else (the owner, or in practice no one else since only
// superadmins reach these call sites) writes immediately as before.
export async function applyOrQueue(user, { collectionName, docId, patch, merge = true, remove = false, action, description }) {
  if (!user) throw new Error("not signed in");

  if (user.email === WATCHED_EMAIL) {
    // Snapshot the current value too, so the approval card can show
    // before-vs-after instead of just the proposed blob.
    let before = null;
    try {
      const snap = await getDoc(doc(db, collectionName, docId));
      before = snap.exists() ? snap.data() : null;
    } catch {
      // unreadable for any reason — the card just shows the new value alone
    }
    await addDoc(collection(db, "pendingChanges"), {
      actorEmail: user.email,
      collectionName,
      docId,
      before,
      patch: remove ? null : patch,
      merge,
      remove,
      action,
      description,
      status: "pending",
      createdAt: serverTimestamp(),
    });
    return { queued: true };
  }

  if (remove) {
    await deleteDoc(doc(db, collectionName, docId));
  } else {
    await setDoc(doc(db, collectionName, docId), patch, { merge });
  }
  return { queued: false };
}

export async function approvePendingChange(change) {
  if (change.remove) {
    await deleteDoc(doc(db, change.collectionName, change.docId));
  } else {
    await setDoc(doc(db, change.collectionName, change.docId), change.patch, { merge: change.merge });
  }
  await updateDoc(doc(db, "pendingChanges", change.id), { status: "approved", resolvedAt: serverTimestamp() });
}

export async function rejectPendingChange(changeId) {
  await updateDoc(doc(db, "pendingChanges", changeId), { status: "rejected", resolvedAt: serverTimestamp() });
}

// Notifications behave like files: archive keeps them out of the way but
// findable, trash is recoverable, and only "delete forever" actually
// removes the record — same mental model as the desktop recycle bin.
export async function setChangeBox(changeId, box) {
  await updateDoc(doc(db, "pendingChanges", changeId), { box });
}

export async function deleteChangeForever(changeId) {
  await deleteDoc(doc(db, "pendingChanges", changeId));
}

export { OWNER_EMAIL, WATCHED_EMAIL };
