import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

// The book cards used to read their "تقدمك في الاستماع / القراءة" bars
// straight out of localStorage, so opening the same account on another
// device showed no progress at all even though the cloud had it. One
// shared subscription per account feeds every card instead — the same
// data the الإعدادات stats panel reads, so the two can't disagree.
let currentUid = null;
let unsubs = [];
let state = { video: {}, pdf: {} };
const listeners = new Set();

function notify() {
  state = { ...state };
  listeners.forEach((fn) => fn());
}

function connect(uid) {
  if (currentUid === uid) return;
  currentUid = uid;
  unsubs.forEach((u) => u());
  unsubs = [];
  state = { video: {}, pdf: {} };
  notify();
  if (!uid) return;

  unsubs.push(
    onSnapshot(query(collection(db, "videoProgress"), where("uid", "==", uid)), (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        const v = d.data();
        if (!v.videoId) return;
        map[v.videoId] =
          v.percent ?? Math.min(100, Math.round(((v.seconds || 0) / (v.duration || 1)) * 100));
      });
      state.video = map;
      notify();
    })
  );

  unsubs.push(
    onSnapshot(query(collection(db, "pdfProgress"), where("uid", "==", uid)), (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        const v = d.data();
        if (v.url) map[v.url] = { page: v.page, numPages: v.numPages, percent: v.percent };
      });
      state.pdf = map;
      notify();
    })
  );
}

export function useMyProgress(uid) {
  const [, force] = useState(0);
  useEffect(() => {
    connect(uid || null);
  }, [uid]);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  return state;
}
