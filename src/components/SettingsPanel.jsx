import { useCalendar } from "../context/CalendarContext";

const OPTIONS = [
  { key: "gregorian", label: "ميلادي", desc: "التقويم الميلادي القياسي" },
  { key: "hijri", label: "هجري", desc: "التقويم الهجري (مدني تراكمي)" },
];

export default function SettingsPanel() {
  const { calendar, setCalendar, formatDate } = useCalendar();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="settings-section">
      <div className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          نظام التقويم لعرض التواريخ
        </div>

        <div className="calendar-options">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className={
                calendar === o.key
                  ? "calendar-option calendar-option-active"
                  : "calendar-option"
              }
              onClick={() => setCalendar(o.key)}
            >
              <span className="calendar-option-check">
                {calendar === o.key && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </span>
              <span className="calendar-option-body">
                <span className="calendar-option-label">{o.label}</span>
                <span className="calendar-option-desc">{o.desc}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="settings-preview">
          مثال على التاريخ الحالي: <strong>{formatDate(today)}</strong>
        </div>

        <p className="hint-text">
          هذا الاختيار يغيّر طريقة عرض التاريخ في كل الأقسام (تاريخ التسجيل،
          بطاقات السجلات)، ولا يغيّر البيانات نفسها المخزّنة.
        </p>
      </div>
    </div>
  );
}
