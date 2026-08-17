import { useCalendar } from "../context/CalendarContext";
import { useTheme } from "../context/ThemeContext";
import { useAuth } from "../context/AuthContext";
import CurriculumAudioSettings from "./CurriculumAudioSettings";
import AllUsersProgress from "./AllUsersProgress";
import MushafFlipSettings from "./MushafFlipSettings";

const CALENDAR_OPTIONS = [
  { key: "gregorian", label: "ميلادي", desc: "التقويم الميلادي القياسي" },
  { key: "hijri", label: "هجري", desc: "التقويم الهجري (مدني تراكمي)" },
];

const THEME_OPTIONS = [
  { key: "light", label: "فاتح", desc: "ألوان فاتحة دائمًا" },
  { key: "dark", label: "داكن", desc: "ألوان داكنة دائمًا" },
  { key: "system", label: "حسب الجهاز", desc: "يتبع إعداد جهازك تلقائيًا" },
];

const THEME_ICONS = {
  light: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  ),
  dark: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
    </svg>
  ),
  system: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  ),
};

const CALENDAR_ICONS = {
  gregorian: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  hijri: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
    </svg>
  ),
};

function SquareOptionList({ options, icons, value, onChange }) {
  return (
    <>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          title={o.desc}
          className={
            value === o.key
              ? "settings-square-option settings-square-option-active"
              : "settings-square-option"
          }
          onClick={() => onChange(o.key)}
        >
          {icons[o.key]}
          <span>{o.label}</span>
        </button>
      ))}
    </>
  );
}

export default function SettingsPanel() {
  const { calendar, setCalendar, formatDate } = useCalendar();
  const { theme, setTheme } = useTheme();
  const { isSuperadmin } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="settings-section">
      <div className="settings-card settings-quick-card">
        <div className="settings-square-row">
          <SquareOptionList options={THEME_OPTIONS} icons={THEME_ICONS} value={theme} onChange={setTheme} />
          <span className="settings-square-divider" />
          <SquareOptionList options={CALENDAR_OPTIONS} icons={CALENDAR_ICONS} value={calendar} onChange={setCalendar} />
        </div>
        <div className="settings-preview settings-preview-compact">
          {formatDate(today)}
        </div>
      </div>

      <AllUsersProgress />

      <MushafFlipSettings />

      {isSuperadmin && <CurriculumAudioSettings />}
    </div>
  );
}
