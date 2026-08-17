import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

// Owner-only: every signed-in viewer's YouTube watch progress, grouped by
// account, so mathelove2@gmail.com can see how everyone is doing at a
// glance — not just their own progress bars scattered across book cards.
export default function AllUsersProgress() {
  const { isSupersuperadmin } = useAuth();
  const [byUid, setByUid] = useState({});
  const [users, setUsers] = useState({});
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isSupersuperadmin) return;
    const unsub = onSnapshot(collection(db, "videoProgress"), (snap) => {
      const grouped = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (!data.uid) return;
        (grouped[data.uid] ||= []).push(data);
      });
      setByUid(grouped);
    });
    return unsub;
  }, [isSupersuperadmin]);

  useEffect(() => {
    if (!isSupersuperadmin) return;
    const unsub = onSnapshot(collection(db, "users"), (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        map[d.id] = d.data();
      });
      setUsers(map);
    });
    return unsub;
  }, [isSupersuperadmin]);

  if (!isSupersuperadmin) return null;

  const rows = Object.entries(byUid)
    .map(([uid, items]) => {
      const avg = Math.round(items.reduce((s, i) => s + (i.percent ?? Math.round(((i.seconds || 0) / (i.duration || 1)) * 100)), 0) / items.length);
      return {
        uid,
        name: users[uid]?.name || users[uid]?.email || uid,
        videosStarted: items.length,
        avgPercent: Math.min(100, avg),
      };
    })
    .sort((a, b) => b.avgPercent - a.avgPercent);

  return (
    <div className="settings-card">
      <button type="button" className="settings-card-title all-progress-toggle" onClick={() => setExpanded((v) => !v)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m5-3.13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-1a4 4 0 1 0 0-8" />
        </svg>
        تقدّم كل المستخدمين ({rows.length})
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`all-progress-chevron${expanded ? " open" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="all-progress-list">
          {rows.length === 0 ? (
            <p className="hint-text">لا يوجد أي تقدّم مسجّل بعد.</p>
          ) : (
            rows.map((r) => (
              <div key={r.uid} className="all-progress-row">
                <span className="all-progress-name">{r.name}</span>
                <span className="all-progress-track">
                  <span className="all-progress-fill" style={{ width: `${r.avgPercent}%` }} />
                </span>
                <span className="all-progress-percent">{r.avgPercent}%</span>
                <span className="all-progress-count">{r.videosStarted} فيديو</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
