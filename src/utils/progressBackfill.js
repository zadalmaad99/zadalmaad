import { useEffect } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { pdfProgressDocId } from "../components/PdfViewerModal";

// Every progress system (YouTube watch position, PDF reading page, mushaf
// page per section) writes to localStorage instantly and only pushes to
// Firestore when a NEW activity event fires. That left everything recorded
// before the cloud sync existed — and anything read without re-triggering a
// write — invisible to the owner's "تقدّم كل المستخدمين" panel, even though
// the book cards showed a real percentage locally.
//
// This walks the signed-in account's own localStorage keys once per session
// and pushes each one up, so the stats panel reflects the same numbers the
// cards do instead of starting from whatever happened to be synced.
function parse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function backfill(user) {
  const uid = user.uid;
  const email = user.email || null;
  const writes = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;
    const raw = localStorage.getItem(key);

    if (key.startsWith(`ytprog_${uid}_`)) {
      const videoId = key.slice(`ytprog_${uid}_`.length);
      const val = parse(raw);
      if (!val?.duration || !videoId) continue;
      writes.push(
        setDoc(
          doc(db, "videoProgress", `${uid}_${videoId}`),
          {
            uid,
            email,
            videoId,
            seconds: val.seconds || 0,
            duration: val.duration,
            updatedAt: Date.now(),
          },
          { merge: true }
        )
      );
    } else if (key.startsWith(`pdfprog_${uid}_`)) {
      const url = key.slice(`pdfprog_${uid}_`.length);
      const val = parse(raw);
      if (!val?.numPages || !url) continue;
      writes.push(
        setDoc(
          doc(db, "pdfProgress", pdfProgressDocId(uid, url)),
          {
            uid,
            email,
            url,
            page: val.page || 1,
            numPages: val.numPages,
            percent: Math.min(100, Math.round(((val.page || 1) / val.numPages) * 100)),
            updatedAt: Date.now(),
          },
          { merge: true }
        )
      );
    } else if (key.startsWith(`mushafPage_${uid}_`)) {
      const section = key.slice(`mushafPage_${uid}_`.length);
      const page = Number(raw);
      if (!page || !section) continue;
      writes.push(
        setDoc(
          doc(db, "quranPageProgress", `${uid}_${section}`),
          { uid, email, section, page, updatedAt: Date.now() },
          { merge: true }
        )
      );
    }
  }

  await Promise.all(writes.map((p) => p.catch(() => {})));
}

export function useProgressBackfill(user) {
  useEffect(() => {
    if (!user?.uid) return;
    backfill(user);
  }, [user?.uid]);
}
