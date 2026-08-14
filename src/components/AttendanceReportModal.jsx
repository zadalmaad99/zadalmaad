import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

const STATUS_LABELS = {
  present: "حضور",
  absent: "غياب",
  excused: "مهلة",
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateToIso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function saturdayOf(d) {
  const c = new Date(d);
  const offset = (c.getDay() + 1) % 7;
  c.setDate(c.getDate() - offset);
  return c;
}

function countBy(records) {
  const counts = { present: 0, absent: 0, excused: 0 };
  records.forEach((r) => {
    if (counts[r.status] !== undefined) counts[r.status] += 1;
  });
  return counts;
}

export default function AttendanceReportModal({ studentId, studentName, onClose, onViewDetails }) {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "attendance"), where("studentId", "==", studentId)),
      (snap) => setRecords(snap.docs.map((d) => d.data()))
    );
    return unsub;
  }, [studentId]);

  const today = new Date();
  const weekStartIso = dateToIso(saturdayOf(today));
  const monthStartIso = dateToIso(new Date(today.getFullYear(), today.getMonth(), 1));
  const todayIso = dateToIso(today);

  const weekRecords = records.filter((r) => r.date >= weekStartIso && r.date <= todayIso);
  const monthRecords = records.filter((r) => r.date >= monthStartIso && r.date <= todayIso);
  const weekCounts = countBy(weekRecords);
  const monthCounts = countBy(monthRecords);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>تقرير الحضور — {studentName}</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="attendance-report-section">
          <h4 className="attendance-report-title">هذا الأسبوع</h4>
          <div className="report-summary">
            <div className="report-stat">
              <span className="report-stat-value">{weekCounts.present}</span>
              <span className="report-stat-label">{STATUS_LABELS.present}</span>
            </div>
            <div className="report-stat">
              <span className="report-stat-value">{weekCounts.absent}</span>
              <span className="report-stat-label">{STATUS_LABELS.absent}</span>
            </div>
            <div className="report-stat">
              <span className="report-stat-value">{weekCounts.excused}</span>
              <span className="report-stat-label">{STATUS_LABELS.excused}</span>
            </div>
          </div>
        </div>

        <div className="attendance-report-section">
          <h4 className="attendance-report-title">هذا الشهر</h4>
          <div className="report-summary">
            <div className="report-stat">
              <span className="report-stat-value">{monthCounts.present}</span>
              <span className="report-stat-label">{STATUS_LABELS.present}</span>
            </div>
            <div className="report-stat">
              <span className="report-stat-value">{monthCounts.absent}</span>
              <span className="report-stat-label">{STATUS_LABELS.absent}</span>
            </div>
            <div className="report-stat">
              <span className="report-stat-value">{monthCounts.excused}</span>
              <span className="report-stat-label">{STATUS_LABELS.excused}</span>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" onClick={onViewDetails}>
            رؤية التفاصيل
          </button>
          <button type="button" className="ghost" onClick={onClose}>
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
}
