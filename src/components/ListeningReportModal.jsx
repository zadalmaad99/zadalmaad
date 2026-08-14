import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { getLessonCount } from "../data/studyPlan";

function groupProgress(progress) {
  const groups = {};
  progress.forEach((p) => {
    const [base, lessonTitle] = p.sheikh?.includes(" — ")
      ? p.sheikh.split(" — ")
      : [p.sheikh, null];
    const key = `${p.book}__${base}`;
    if (!groups[key]) {
      groups[key] = {
        book: p.book,
        sheikh: base,
        lessons: [],
        downloaded: false,
        updatedAt: 0,
      };
    }
    groups[key].lessons.push({ title: lessonTitle, percent: p.progressPercent || 0 });
    groups[key].downloaded = groups[key].downloaded || !!p.downloaded;
    groups[key].updatedAt = Math.max(groups[key].updatedAt, p.updatedAt || 0);
  });

  return Object.values(groups).map((g) => {
    const totalLessons = getLessonCount(g.book, g.sheikh);
    const doneLessons = g.lessons.filter((l) => l.percent >= 100).length;
    const sumPercent = g.lessons.reduce((s, l) => s + l.percent, 0);
    const overallPercent = totalLessons > 0 ? Math.round(sumPercent / totalLessons) : 0;
    const isComplete = totalLessons > 0 && doneLessons >= totalLessons;
    return { ...g, totalLessons, doneLessons, overallPercent, isComplete };
  });
}

export default function ListeningReportModal({ studentId, studentName, onClose }) {
  const [progress, setProgress] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "listeningProgress"), where("studentId", "==", studentId)),
      (snap) => setProgress(snap.docs.map((d) => d.data()))
    );
    return unsub;
  }, [studentId]);

  const grouped = groupProgress(progress).sort((a, b) => b.updatedAt - a.updatedAt);

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

        {grouped.length === 0 ? (
          <p className="empty">لم يستمع الطالب إلى أي شرح بعد</p>
        ) : (
          <ol className="listening-report-list">
            {grouped.map((g, i) => (
              <li key={i} className="listening-report-item">
                <div className="listening-report-item-head">
                  <span className="listening-report-item-book">{g.book}</span>
                  {g.downloaded && (
                    <span className="listening-report-item-downloaded">تم التنزيل</span>
                  )}
                </div>
                <span className="listening-report-item-sheikh">{g.sheikh}</span>
                <div className="leaderboard-bar">
                  <div
                    className="leaderboard-bar-fill"
                    style={{ width: `${g.overallPercent}%` }}
                  />
                </div>
                <span className="listening-report-item-pct">
                  {g.totalLessons > 1
                    ? `${g.doneLessons}/${g.totalLessons} دروس — ${g.overallPercent}٪`
                    : `${g.overallPercent}٪`}
                </span>
                {g.isComplete && (
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
