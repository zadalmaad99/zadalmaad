import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import StudentsPanel from "../components/StudentsPanel";
import TrackingSection from "../components/TrackingSection";
import HadithTrackingSection from "../components/HadithTrackingSection";
import OverviewDashboard from "../components/OverviewDashboard";
import SettingsPanel from "../components/SettingsPanel";
import AttendancePanel from "../components/AttendancePanel";
import logo from "../assets/logo.png";

const ICONS = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20V10M11 20V4M18 20v-7" />
    </svg>
  ),
  attendance: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <path d="M9 16l2 2 4-4" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  ),
  students: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="9" cy="7" r="3.2" />
      <path d="M2.5 20c.7-3.6 3.3-5.6 6.5-5.6s5.8 2 6.5 5.6" />
      <circle cx="17" cy="8" r="2.4" />
      <path d="M15.5 14.6c2.6.2 4.6 2 5.2 5" />
    </svg>
  ),
  hifz: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 4.5C4 3.7 4.7 3 5.5 3H12v18H5.5c-.8 0-1.5-.7-1.5-1.5v-15Z" />
      <path d="M20 4.5c0-.8-.7-1.5-1.5-1.5H12v18h6.5c.8 0 1.5-.7 1.5-1.5v-15Z" />
    </svg>
  ),
  qiraah: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  ),
  murajaah: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 12a8 8 0 1 1 2.6 5.9" />
      <path d="M4 20v-5h5" />
    </svg>
  ),
  quran: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 4.5C4 3.7 4.7 3 5.5 3H12v18H5.5c-.8 0-1.5-.7-1.5-1.5v-15Z" />
      <path d="M20 4.5c0-.8-.7-1.5-1.5-1.5H12v18h6.5c.8 0 1.5-.7 1.5-1.5v-15Z" />
    </svg>
  ),
  hadith: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 21c-2.2-1.6-4.8-2.4-7.5-2.4V5.6C7.2 5.6 9.8 6.4 12 8c2.2-1.6 4.8-2.4 7.5-2.4v13c-2.7 0-5.3.8-7.5 2.4Z" />
      <path d="M12 8v13" />
    </svg>
  ),
};

const SUB_SECTIONS = [
  { key: "hifz", label: "حفظ" },
  { key: "qiraah", label: "قراءة" },
  { key: "murajaah", label: "مراجعة" },
];

const TABS = [
  {
    key: "overview",
    label: "العام",
    navLabel: "العام",
    desc: "ترتيب الطلاب حسب التقدم في كل الأقسام",
  },
  { key: "students", label: "الطلاب", navLabel: "الطلاب", desc: "إدارة قائمة الطلاب" },
  {
    key: "quran",
    label: "القرآن الكريم",
    navLabel: "القرآن",
    desc: "متابعة الحفظ والقراءة والمراجعة للقرآن الكريم",
  },
  {
    key: "hadith",
    label: "الحديث الشريف",
    navLabel: "الحديث",
    desc: "متابعة حفظ وقراءة ومراجعة أحاديث الكتب الستة",
  },
  {
    key: "attendance",
    label: "الحضور والغياب",
    navLabel: "الحضور",
    desc: "تسجيل حضور وغياب ومهلة كل طالب",
  },
  {
    key: "settings",
    label: "الإعدادات",
    navLabel: "الإعدادات",
    desc: "تخصيص طريقة عرض التطبيق",
  },
];

const QURAN_TITLES = {
  hifz: "سجلات الحفظ اليومي",
  qiraah: "سجلات القراءة",
  murajaah: "سجلات المراجعة",
};

const HADITH_TITLES = {
  hifz: "سجلات حفظ الحديث",
  qiraah: "سجلات قراءة الحديث",
  murajaah: "سجلات مراجعة الحديث",
};

export default function Dashboard() {
  const { logout, isAdmin } = useAuth();
  const visibleTabs = isAdmin
    ? TABS
    : TABS.filter(
        (t) => !["students", "overview", "settings"].includes(t.key)
      );
  const [tab, setTab] = useState(isAdmin ? "overview" : "quran");
  const [quranSub, setQuranSub] = useState("hifz");
  const [hadithSub, setHadithSub] = useState("hifz");
  const [focusStudentId, setFocusStudentId] = useState(null);
  const current = visibleTabs.find((t) => t.key === tab) || visibleTabs[0];

  function goToSection(sectionKey, studentId) {
    setFocusStudentId(studentId);
    if (["hifz", "qiraah", "murajaah"].includes(sectionKey)) {
      setTab("quran");
      setQuranSub(sectionKey);
    } else {
      setTab(sectionKey);
    }
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand">
          <img src={logo} alt="شعار التطبيق" className="brand-mark" />
          <div>
            <h1>زاد المعاد</h1>
            <span className="brand-sub">حفظ وقراءة ومراجعة القرآن والحديث</span>
          </div>
        </div>

        <nav>
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              className={tab === t.key ? "nav-btn active" : "nav-btn"}
              onClick={() => setTab(t.key)}
            >
              <span className="nav-icon">{ICONS[t.key]}</span>
              {t.navLabel}
            </button>
          ))}
        </nav>

        <button className="logout-btn" onClick={logout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M15 17l5-5-5-5M20 12H9M12 19H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6" />
          </svg>
          خروج
        </button>
      </aside>

      <main className="content">
        <header className="content-header">
          <h2>{current.label}</h2>
          <p>{current.desc}</p>
        </header>

        {(tab === "quran" || tab === "hadith") && (
          <div className="subnav">
            {SUB_SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={
                  (tab === "quran" ? quranSub : hadithSub) === s.key
                    ? "subnav-btn active"
                    : "subnav-btn"
                }
                onClick={() =>
                  tab === "quran" ? setQuranSub(s.key) : setHadithSub(s.key)
                }
              >
                <span className="nav-icon">{ICONS[s.key]}</span>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {tab === "overview" && isAdmin && (
          <OverviewDashboard onNavigate={goToSection} />
        )}
        {tab === "students" && isAdmin && (
          <StudentsPanel onNavigate={goToSection} />
        )}
        {tab === "settings" && isAdmin && <SettingsPanel />}
        {tab === "quran" && (
          <TrackingSection
            type={quranSub}
            title={QURAN_TITLES[quranSub]}
            focusStudentId={focusStudentId}
            onFocusHandled={() => setFocusStudentId(null)}
          />
        )}
        {tab === "hadith" && (
          <HadithTrackingSection
            type={hadithSub}
            title={HADITH_TITLES[hadithSub]}
            focusStudentId={focusStudentId}
            onFocusHandled={() => setFocusStudentId(null)}
          />
        )}
        {tab === "attendance" && (
          <AttendancePanel
            focusStudentId={tab === "attendance" ? focusStudentId : null}
            onFocusHandled={() => setFocusStudentId(null)}
          />
        )}
      </main>
    </div>
  );
}
