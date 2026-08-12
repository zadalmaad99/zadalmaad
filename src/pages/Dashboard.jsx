import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import StudentsPanel from "../components/StudentsPanel";
import TrackingSection from "../components/TrackingSection";
import OverviewDashboard from "../components/OverviewDashboard";
import SettingsPanel from "../components/SettingsPanel";
import logo from "../assets/logo.png";

const ICONS = {
  overview: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 20V10M11 20V4M18 20v-7" />
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
};

const TABS = [
  {
    key: "overview",
    label: "لوحة التحكم",
    navLabel: "لوحة التحكم",
    desc: "ترتيب الطلاب حسب التقدم في كل الأقسام",
  },
  { key: "students", label: "الطلاب", navLabel: "الطلاب", desc: "إدارة قائمة الطلاب" },
  { key: "hifz", label: "حفظ القرآن يوميًا", navLabel: "حفظ", desc: "متابعة الحفظ اليومي" },
  { key: "qiraah", label: "قراءة القرآن", navLabel: "قراءة", desc: "متابعة القراءة اليومية" },
  { key: "murajaah", label: "مراجعة حفظ القرآن", navLabel: "مراجعة", desc: "متابعة المراجعة" },
  {
    key: "settings",
    label: "الإعدادات",
    navLabel: "الإعدادات",
    desc: "تخصيص طريقة عرض التطبيق",
  },
];

export default function Dashboard() {
  const { logout, isAdmin } = useAuth();
  const visibleTabs = isAdmin
    ? TABS
    : TABS.filter(
        (t) => !["students", "overview", "settings"].includes(t.key)
      );
  const [tab, setTab] = useState(isAdmin ? "overview" : "hifz");
  const [focusStudentId, setFocusStudentId] = useState(null);
  const current = visibleTabs.find((t) => t.key === tab) || visibleTabs[0];

  function goToSection(sectionKey, studentId) {
    setFocusStudentId(studentId);
    setTab(sectionKey);
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="brand">
          <img src={logo} alt="شعار التطبيق" className="brand-mark" />
          <div>
            <h1>لوحة المراقبة</h1>
            <span className="brand-sub">حفظ وقراءة القرآن الكريم</span>
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

        {tab === "overview" && isAdmin && (
          <OverviewDashboard onNavigate={goToSection} />
        )}
        {tab === "students" && isAdmin && <StudentsPanel />}
        {tab === "settings" && isAdmin && <SettingsPanel />}
        {tab === "hifz" && (
          <TrackingSection
            type="hifz"
            title="سجلات الحفظ اليومي"
            focusStudentId={tab === "hifz" ? focusStudentId : null}
            onFocusHandled={() => setFocusStudentId(null)}
          />
        )}
        {tab === "qiraah" && (
          <TrackingSection
            type="qiraah"
            title="سجلات القراءة"
            focusStudentId={tab === "qiraah" ? focusStudentId : null}
            onFocusHandled={() => setFocusStudentId(null)}
          />
        )}
        {tab === "murajaah" && (
          <TrackingSection
            type="murajaah"
            title="سجلات المراجعة"
            focusStudentId={tab === "murajaah" ? focusStudentId : null}
            onFocusHandled={() => setFocusStudentId(null)}
          />
        )}
      </main>
    </div>
  );
}
