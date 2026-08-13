import { useCalendar } from "../context/CalendarContext";

function daysBetween(startIso, endIso) {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  return Math.round((end - start) / 86400000) + 1;
}

export default function HadithReportModal({ record, studentName, onClose }) {
  const { formatDate } = useCalendar();
  const history = [...(record.history || [])].sort((a, b) =>
    a.date === b.date ? a.at - b.at : a.date.localeCompare(b.date)
  );

  const first = history[0];
  const last = history[history.length - 1];
  const days = first && last ? daysBetween(first.date, last.date) : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            تقرير التقدم — {studentName} — {record.bookName}
          </h3>
          <button type="button" className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="report-summary">
          <div className="report-stat">
            <span className="report-stat-value">{days}</span>
            <span className="report-stat-label">يوم</span>
          </div>
          <div className="report-stat">
            <span className="report-stat-value">{last?.hadithNumber || 0}</span>
            <span className="report-stat-label">حديث</span>
          </div>
          <div className="report-stat">
            <span className="report-stat-value">{history.length}</span>
            <span className="report-stat-label">جلسة</span>
          </div>
        </div>

        {first && last && (
          <p className="hint-text report-range">
            من {formatDate(first.date)} إلى {formatDate(last.date)}
          </p>
        )}

        <ol className="report-timeline">
          {history.map((h, i) => {
            const prev = history[i - 1];
            const gained = prev ? h.hadithNumber - prev.hadithNumber : h.hadithNumber;
            return (
              <li key={i} className="report-item">
                <span className="report-item-dot" />
                <div className="report-item-body">
                  <div className="report-item-date">{formatDate(h.date)}</div>
                  <div className="report-item-range">
                    وصل إلى الحديث رقم {h.hadithNumber}
                    {gained > 0 && (
                      <span className="report-item-gain"> (+{gained} حديث)</span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
          {history.length === 0 && (
            <p className="empty">لا يوجد سجل تفصيلي لهذا التقدم</p>
          )}
        </ol>
      </div>
    </div>
  );
}
