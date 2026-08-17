import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { SUPPORT_PHONE, SUPPORT_WHATSAPP } from "../utils/pendingChanges";
import { changeKind, diffRows } from "../utils/changeDiff";

const STATUS = {
  pending: {
    label: "قيد المراجعة",
    message: "تم إرسال الطلب إلى مطوّر ومبرمج الموقع، وسيتم الرد عليه إن شاء الله في أقرب وقت ممكن.",
  },
  approved: {
    label: "مقبول",
    message: "تم قبول طلبك وتطبيقه على الموقع. جزاك الله خيرًا.",
  },
  rejected: {
    label: "مرفوض",
    message: "تم رفض الطلب، نعتذر منك. للتواصل معنا عبر واتساب:",
  },
};

// The watched superadmin's side of the approval queue: every request it
// sent, and the decision on it — shown as cards with the same قبل/بعد
// detail the owner reviewed, not just a one-line alert.
export default function MyRequestsBell() {
  const { user } = useAuth();
  const [changes, setChanges] = useState([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("myRequestsSeen")) || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (!user?.email) return;
    // Deliberately no orderBy: combining it with the where() would demand a
    // composite index, and this list is small enough to sort here.
    const q = query(collection(db, "pendingChanges"), where("actorEmail", "==", user.email));
    const unsub = onSnapshot(q, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setChanges(rows.slice(0, 40));
    });
    return unsub;
  }, [user?.email]);

  // Badge counts decisions this account hasn't opened the panel on yet.
  const decided = changes.filter((c) => c.status === "approved" || c.status === "rejected");
  const unseen = decided.filter((c) => !seen.includes(c.id));

  function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next && unseen.length) {
      const ids = [...seen, ...unseen.map((c) => c.id)];
      setSeen(ids);
      try {
        localStorage.setItem("myRequestsSeen", JSON.stringify(ids));
      } catch {
        // storage unavailable — the badge just reappears next time
      }
    }
  }

  function formatWhen(ts) {
    const d = ts?.toDate ? ts.toDate() : null;
    if (!d) return "الآن";
    return d.toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
  }

  return (
    <div className="admin-alerts-bell-wrap">
      <button type="button" className="admin-alerts-bell" onClick={handleOpen} aria-label="طلباتي">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unseen.length > 0 && <span className="admin-alerts-badge">{unseen.length}</span>}
      </button>

      {open && (
        <div className="admin-alerts-panel">
          <p className="admin-alerts-panel-title">طلباتي وحالتها</p>

          {changes.length === 0 ? (
            <p className="admin-alerts-empty">لم ترسل أي طلب بعد</p>
          ) : (
            <ul className="admin-alerts-list">
              {changes.map((c) => {
                const kind = changeKind(c);
                const st = STATUS[c.status] || STATUS.pending;
                const rows = c.remove ? [] : diffRows(c.before, c.patch);
                return (
                  <li key={c.id} className={`admin-alerts-item${c.status === "pending" ? " unread" : ""}`}>
                    <span className="admin-alerts-item-action">
                      <span className={`admin-alerts-kind ${kind.cls}`}>{kind.text}</span>
                      {c.action}
                      <span className={`admin-alerts-status ${c.status}`}>{st.label}</span>
                    </span>

                    <div className={`my-request-note ${c.status}`}>
                      {st.message}
                      {c.status === "rejected" && (
                        <a
                          className="my-request-whatsapp"
                          href={SUPPORT_WHATSAPP}
                          target="_blank"
                          rel="noreferrer"
                          dir="ltr"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Zm5.5 14.1c-.2.6-1.2 1.2-1.7 1.2-.5.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1-1.4-1-2.6 0-1.2.6-1.8.9-2 .2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.8 1.9c.1.1.1.3 0 .5l-.3.4-.3.4c-.1.1-.2.3 0 .5.1.3.6 1.1 1.4 1.7 1 .8 1.7 1.1 2 1.2.2.1.4.1.5-.1l.7-.9c.2-.2.3-.2.5-.1l1.8.9c.2.1.4.2.4.3.1.1.1.6-.1 1.2Z" />
                          </svg>
                          {SUPPORT_PHONE}
                        </a>
                      )}
                    </div>

                    {rows.length > 0 && (
                      <div className="admin-alerts-diff">
                        {rows.slice(0, 6).map((r, i) => (
                          <div className="admin-alerts-diff-row" key={i}>
                            <span className="admin-alerts-diff-field">{r.field}</span>
                            <span className="admin-alerts-diff-change">
                              <span className="admin-alerts-diff-before">{r.before}</span>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                                <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
                              </svg>
                              <span className="admin-alerts-diff-after">{r.after}</span>
                            </span>
                          </div>
                        ))}
                        {rows.length > 6 && (
                          <p className="admin-alerts-diff-more">و{rows.length - 6} تغييرًا آخر…</p>
                        )}
                      </div>
                    )}

                    <span className="admin-alerts-item-time">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                      </svg>
                      {formatWhen(c.createdAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
