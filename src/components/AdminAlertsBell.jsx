import { useEffect, useState } from "react";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import {
  approvePendingChange,
  deleteChangeForever,
  rejectPendingChange,
  setChangeBox,
} from "../utils/pendingChanges";
import { changeKind, diffRows } from "../utils/changeDiff";

const BOXES = [
  { key: "inbox", label: "الوارد" },
  { key: "archive", label: "الأرشيف" },
  { key: "trash", label: "سلة المهملات" },
];

// Visible only to mathelove2@gmail.com — every change admin.zadalmaad@admin.com
// tries to make lands here first. Nothing applies until it's approved.
export default function AdminAlertsBell() {
  const { isSupersuperadmin } = useAuth();
  const [changes, setChanges] = useState([]);
  const [open, setOpen] = useState(false);
  const [box, setBox] = useState("inbox");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!isSupersuperadmin) return;
    const q = query(collection(db, "pendingChanges"), orderBy("createdAt", "desc"), limit(60));
    const unsub = onSnapshot(q, (snap) => {
      setChanges(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [isSupersuperadmin]);

  if (!isSupersuperadmin) return null;

  // Docs written before boxes existed have no `box` field — treat them as inbox.
  const inBox = changes.filter((c) => (c.box || "inbox") === box);
  const pendingCount = changes.filter(
    (c) => c.status === "pending" && (c.box || "inbox") === "inbox"
  ).length;

  async function run(id, fn) {
    setBusyId(id);
    try {
      await fn();
    } catch {
      window.alert("تعذّر تنفيذ العملية — حاول مجددًا");
    } finally {
      setBusyId(null);
    }
  }

  async function emptyTrash() {
    if (!window.confirm(`حذف ${inBox.length} إشعارًا نهائيًا؟ لا يمكن التراجع.`)) return;
    setBusyId("all");
    try {
      await Promise.all(inBox.map((c) => deleteChangeForever(c.id)));
    } catch {
      window.alert("تعذّر الحذف — حاول مجددًا");
    } finally {
      setBusyId(null);
    }
  }

  async function archiveAll() {
    setBusyId("all");
    try {
      await Promise.all(
        inBox.filter((c) => c.status !== "pending").map((c) => setChangeBox(c.id, "archive"))
      );
    } catch {
      window.alert("تعذّرت الأرشفة — حاول مجددًا");
    } finally {
      setBusyId(null);
    }
  }

  function formatWhen(ts) {
    // serverTimestamp() is null in the local echo until the server write
    // lands, so show something meaningful rather than an empty line.
    const d = ts?.toDate ? ts.toDate() : null;
    if (!d) return "الآن";
    return d.toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" });
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
        {pendingCount > 0 && <span className="admin-alerts-badge">{pendingCount}</span>}
      </button>

      {open && (
        <div className="admin-alerts-panel">
          <p className="admin-alerts-panel-title">تعديلات admin.zadalmaad@admin.com</p>

          <div className="admin-alerts-tabs">
            {BOXES.map((b) => (
              <button
                key={b.key}
                type="button"
                className={box === b.key ? "admin-alerts-tab active" : "admin-alerts-tab"}
                onClick={() => setBox(b.key)}
              >
                {b.label}
                <span className="admin-alerts-tab-count">
                  {changes.filter((c) => (c.box || "inbox") === b.key).length}
                </span>
              </button>
            ))}
          </div>

          {inBox.length > 0 && (
            <div className="admin-alerts-bulk">
              {box === "trash" ? (
                <button type="button" className="admin-alerts-bulk-danger" disabled={busyId === "all"} onClick={emptyTrash}>
                  إفراغ السلة نهائيًا
                </button>
              ) : (
                <button type="button" className="admin-alerts-bulk-btn" disabled={busyId === "all"} onClick={archiveAll}>
                  أرشفة المنتهية
                </button>
              )}
            </div>
          )}

          {inBox.length === 0 ? (
            <p className="admin-alerts-empty">لا يوجد شيء هنا</p>
          ) : (
            <ul className="admin-alerts-list">
              {inBox.map((c) => {
                const kind = changeKind(c);
                const rows = c.remove ? [] : diffRows(c.before, c.patch);
                return (
                  <li key={c.id} className={`admin-alerts-item${c.status === "pending" ? " unread" : ""}`}>
                    <span className="admin-alerts-item-action">
                      <span className={`admin-alerts-kind ${kind.cls}`}>{kind.text}</span>
                      {c.action}
                      {c.status !== "pending" && (
                        <span className={`admin-alerts-status ${c.status}`}>
                          {c.status === "approved" ? "تمت الموافقة" : "مرفوض"}
                        </span>
                      )}
                    </span>
                    {/* Some older entries stored the raw patch as their
                        description; the diff below says it far better. */}
                    {c.description && !c.description.trimStart().startsWith("{") && (
                      <span className="admin-alerts-item-desc">{c.description}</span>
                    )}

                    {c.remove ? (
                      <div className="admin-alerts-diff">
                        <div className="admin-alerts-diff-row">
                          <span className="admin-alerts-diff-field">الإجراء</span>
                          <span className="admin-alerts-diff-change">
                            <span className="admin-alerts-diff-before">موجود</span>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                              <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
                            </svg>
                            <span className="admin-alerts-diff-after removed">سيُحذف</span>
                          </span>
                        </div>
                      </div>
                    ) : rows.length > 0 ? (
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
                    ) : null}

                    <span className="admin-alerts-item-time">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                      </svg>
                      {formatWhen(c.createdAt)}
                    </span>

                    <span className="admin-alerts-item-actions">
                      {c.status === "pending" && (
                        <>
                          <button
                            type="button"
                            className="admin-alerts-approve"
                            disabled={busyId === c.id}
                            onClick={() => run(c.id, () => approvePendingChange(c))}
                          >
                            موافقة
                          </button>
                          <button
                            type="button"
                            className="admin-alerts-reject"
                            disabled={busyId === c.id}
                            onClick={() => run(c.id, () => rejectPendingChange(c.id))}
                          >
                            رفض
                          </button>
                        </>
                      )}

                      {box === "trash" ? (
                        <>
                          <button
                            type="button"
                            className="admin-alerts-ghost"
                            disabled={busyId === c.id}
                            onClick={() => run(c.id, () => setChangeBox(c.id, "inbox"))}
                          >
                            استعادة
                          </button>
                          <button
                            type="button"
                            className="admin-alerts-reject"
                            disabled={busyId === c.id}
                            onClick={() =>
                              window.confirm("حذف هذا الإشعار نهائيًا؟") &&
                              run(c.id, () => deleteChangeForever(c.id))
                            }
                          >
                            حذف نهائي
                          </button>
                        </>
                      ) : (
                        <>
                          {box !== "archive" && c.status !== "pending" && (
                            <button
                              type="button"
                              className="admin-alerts-ghost"
                              disabled={busyId === c.id}
                              onClick={() => run(c.id, () => setChangeBox(c.id, "archive"))}
                            >
                              أرشفة
                            </button>
                          )}
                          {box === "archive" && (
                            <button
                              type="button"
                              className="admin-alerts-ghost"
                              disabled={busyId === c.id}
                              onClick={() => run(c.id, () => setChangeBox(c.id, "inbox"))}
                            >
                              إرجاع للوارد
                            </button>
                          )}
                          <button
                            type="button"
                            className="admin-alerts-ghost"
                            disabled={busyId === c.id}
                            onClick={() => run(c.id, () => setChangeBox(c.id, "trash"))}
                          >
                            حذف
                          </button>
                        </>
                      )}
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
