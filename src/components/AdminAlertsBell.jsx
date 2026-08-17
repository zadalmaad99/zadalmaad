import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { approvePendingChange, rejectPendingChange } from "../utils/pendingChanges";

// Visible only to mathelove2@gmail.com — every change admin.zadalmaad@admin.com
// tries to make lands here first. Nothing applies until it's approved.
export default function AdminAlertsBell() {
  const { isSupersuperadmin } = useAuth();
  const [changes, setChanges] = useState([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!isSupersuperadmin) return;
    const q = query(collection(db, "pendingChanges"), orderBy("createdAt", "desc"), limit(30));
    const unsub = onSnapshot(q, (snap) => {
      setChanges(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [isSupersuperadmin]);

  if (!isSupersuperadmin) return null;

  const pending = changes.filter((c) => c.status === "pending");

  async function handleApprove(change) {
    setBusyId(change.id);
    try {
      await approvePendingChange(change);
    } catch {
      window.alert("تعذّرت الموافقة — حاول مجددًا");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReject(id) {
    setBusyId(id);
    try {
      await rejectPendingChange(id);
    } catch {
      window.alert("تعذّر الرفض — حاول مجددًا");
    } finally {
      setBusyId(null);
    }
  }

  function formatWhen(ts) {
    if (!ts?.toDate) return "";
    return ts.toDate().toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" });
  }

  return (
    <div className="admin-alerts-bell-wrap">
      <button
        type="button"
        className="admin-alerts-bell"
        onClick={() => setOpen((v) => !v)}
        aria-label="تعديلات بانتظار الموافقة"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {pending.length > 0 && <span className="admin-alerts-badge">{pending.length}</span>}
      </button>

      {open && (
        <div className="admin-alerts-panel">
          <p className="admin-alerts-panel-title">تعديلات admin.zadalmaad@admin.com</p>
          {changes.length === 0 ? (
            <p className="admin-alerts-empty">لا يوجد نشاط بعد</p>
          ) : (
            <ul className="admin-alerts-list">
              {changes.map((c) => (
                <li key={c.id} className={`admin-alerts-item${c.status === "pending" ? " unread" : ""}`}>
                  <span className="admin-alerts-item-action">
                    {c.action}
                    {c.status !== "pending" && (
                      <span className={`admin-alerts-status ${c.status}`}>
                        {c.status === "approved" ? "تمت الموافقة" : "مرفوض"}
                      </span>
                    )}
                  </span>
                  <span className="admin-alerts-item-desc">{c.description}</span>
                  <span className="admin-alerts-item-time">{formatWhen(c.createdAt)}</span>
                  {c.status === "pending" && (
                    <span className="admin-alerts-item-actions">
                      <button
                        type="button"
                        className="admin-alerts-approve"
                        disabled={busyId === c.id}
                        onClick={() => handleApprove(c)}
                      >
                        موافقة
                      </button>
                      <button
                        type="button"
                        className="admin-alerts-reject"
                        disabled={busyId === c.id}
                        onClick={() => handleReject(c.id)}
                      >
                        رفض
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
