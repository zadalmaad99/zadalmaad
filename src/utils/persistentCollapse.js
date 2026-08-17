import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const STORAGE_KEY = "menhaj_section_collapsed";

function readLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function writeLocal(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // private-browsing / storage-quota — still works this session
  }
}

// One shared Firestore subscription per uid (not one per باب section) so
// opening the same account on a phone and a computer shows the exact same
// open/closed layout everywhere, live — a section collapsed on one device
// shows collapsed on the other without a manual refresh.
let currentUid = null;
let unsubscribe = null;
let map = readLocal();
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(map));
}

function connect(uid) {
  if (currentUid === uid) return;
  currentUid = uid;
  unsubscribe?.();
  unsubscribe = null;
  if (!uid) {
    map = readLocal();
    notify();
    return;
  }
  unsubscribe = onSnapshot(doc(db, "userPrefs", uid), (snap) => {
    map = snap.data()?.menhajCollapsed || {};
    writeLocal(map);
    notify();
  });
}

function setCollapsed(uid, key, value) {
  map = { ...map, [key]: value };
  writeLocal(map);
  notify();
  if (uid) {
    setDoc(doc(db, "userPrefs", uid), { menhajCollapsed: map }, { merge: true }).catch(() => {});
  }
}

export function useSectionCollapse(key) {
  const [, forceRender] = useState(0);
  const uid = currentUid;

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);
    listeners.add(listener);
    return () => listeners.delete(listener);
  }, []);

  return [!!map[key], () => setCollapsed(uid, key, !map[key])];
}

// Called once near the top of the المنهج tree (with the signed-in uid, or
// null for a signed-out visitor) so every section's hook shares one
// connection instead of opening a Firestore listener per باب.
export function useCollapseSync(uid) {
  useEffect(() => {
    connect(uid || null);
  }, [uid]);
}
