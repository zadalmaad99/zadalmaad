import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

export default function ListeningReportModal({ studentId, studentName, onClose }) {
  const [progress, setProgress] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "listeningProgress"), where("studentId", "==", studentId)),
      (snap) => setProgress(snap.docs.map((d) => d.data()))
    );
    return unsub;
  }, [studentId]);

  const sorted = [...progress].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>تقرير الاستماع للمنهج — {studentName}</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="empty">لم يستمع الطالب إلى أي شرح بعد</p>
        ) : (
          <ol className="listening-report-list">
            {sorted.map((p, i) => (
              <li key={i} className="listening-report-item">
                <div className="listening-report-item-head">
                  <span className="listening-report-item-book">{p.book}</span>
                  {p.downloaded && (
                    <span className="listening-report-item-downloaded">تم التنزيل</span>
                  )}
                </div>
                <span className="listening-report-item-sheikh">{p.sheikh}</span>
                <div className="leaderboard-bar">
                  <div
                    className="leaderboard-bar-fill"
                    style={{ width: `${p.progressPercent || 0}%` }}
                  />
                </div>
                <span className="listening-report-item-pct">{p.progressPercent || 0}٪</span>
                {p.progressPercent >= 100 && (
                  <div className="listening-report-item-done">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    الطالب خلص هذا الكتاب استماعًا
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}

        <div className="form-actions">
          <button type="button" className="ghost" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
