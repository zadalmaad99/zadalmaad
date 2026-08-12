import { useCalendar } from "../context/CalendarContext";
import { useTheme } from "../context/ThemeContext";

const CALENDAR_OPTIONS = [
  { key: "gregorian", label: "ميلادي", desc: "التقويم الميلادي القياسي" },
  { key: "hijri", label: "هجري", desc: "التقويم الهجري (مدني تراكمي)" },
];

const THEME_OPTIONS = [
  { key: "light", label: "فاتح", desc: "ألوان فاتحة دائمًا" },
  { key: "dark", label: "داكن", desc: "ألوان داكنة دائمًا" },
  { key: "system", label: "حسب الجهاز", desc: "يتبع إعداد جهازك تلقائيًا" },
];

function OptionList({ options, value, onChange }) {
  return (
    <div className="calendar-options">
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={
            value === o.key
              ? "calendar-option calendar-option-active"
              : "calendar-option"
          }
          onClick={() => onChange(o.key)}
        >
          <span className="calendar-option-check">
            {value === o.key && (
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
  );
}

export default function SettingsPanel() {
  const { calendar, setCalendar, formatDate } = useCalendar();
  const { theme, setTheme } = useTheme();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="settings-section">
      <div className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
          </svg>
          مظهر التطبيق
        </div>
        <OptionList options={THEME_OPTIONS} value={theme} onChange={setTheme} />
      </div>

      <div className="settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          نظام التقويم لعرض التواريخ
        </div>

        <OptionList
          options={CALENDAR_OPTIONS}
          value={calendar}
          onChange={setCalendar}
        />

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
