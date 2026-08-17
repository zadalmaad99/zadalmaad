import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import StudentsPanel from "../components/StudentsPanel";
import QuranPageTracking from "../components/QuranPageTracking";
import OverviewDashboard from "../components/OverviewDashboard";
import SettingsPanel from "../components/SettingsPanel";
import AttendancePanel from "../components/AttendancePanel";
import SuperadminDashboard from "../components/SuperadminDashboard";
import ScrollButtons from "../components/ScrollButtons";
import MenhajAccordion from "../components/MenhajAccordion";
import AdminAlertsBell from "../components/AdminAlertsBell";
import { QuranPageViewer } from "../components/QuranPageModal";
import { getPageInfo, hizbLabel } from "../utils/quranPageInfo";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useProgressBackfill } from "../utils/progressBackfill";
import logo from "../assets/logo.png";

const NAV_STORAGE_KEY = "quran-tracker-nav";

function readNav() {
  try {
    return JSON.parse(localStorage.getItem(NAV_STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

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
  mushaf: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 4.5C4 3.7 4.7 3 5.5 3H12v18H5.5c-.8 0-1.5-.7-1.5-1.5v-15Z" />
      <path d="M20 4.5c0-.8-.7-1.5-1.5-1.5H12v18h6.5c.8 0 1.5-.7 1.5-1.5v-15Z" />
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
  superadmin: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="13" height="18" rx="1.5" />
      <path d="M6.5 7.5h6M6.5 11h6M6.5 14.5h3.5" />
      <path d="M15.5 16.5 20 12l1.5 1.5L17 18l-2 .5.5-2Z" />
    </svg>
  ),
};

const SUB_SECTIONS = [
  { key: "qiraah", label: "قراءة" },
  { key: "hifz", label: "حفظ" },
  { key: "murajaah", label: "مراجعة" },
];

// Sidebar order is deliberate: العام، القرآن، المنهج، المعلّم، الطلاب،
// الحضور، الإعدادات — the daily-use sections come before the
// administrative ones.
const TABS = [
  {
    key: "overview",
    label: "العام",
    navLabel: "العام",
    desc: "ترتيب الطلاب حسب التقدم في كل الأقسام",
  },
  {
    key: "quran",
    label: "القرآن الكريم",
    navLabel: "القرآن",
    desc: "متابعة الحفظ والقراءة والمراجعة للقرآن الكريم",
  },
  {
    key: "hadith",
    label: "المنهج",
    navLabel: "المنهج",
    desc: "متابعة حفظ وقراءة ومراجعة أحاديث الكتب الستة",
  },
  {
    key: "superadmin",
    label: "لوحة الإشراف",
    navLabel: "المعلّم",
    desc: "متابعة كل المعلمين المسجّلين وعدد طلابهم ونشاطهم",
  },
  { key: "students", label: "الطلاب", navLabel: "الطلاب", desc: "إدارة قائمة الطلاب" },
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

function mushafPageKey(uid, section) {
  return `mushafPage_${uid || "anon"}_${section}`;
}

// The physical mus-haf reader, embedded directly inside each of the
// قراءة/حفظ/مراجعة tabs (no separate المصحف tab anymore) — each section
// remembers its own page independently and strictly, per account, exactly
// like a real bookmark: it never jumps back to الفاتحة on refresh, only
// when the viewer themselves turns the page.
function MushafTabReader({ section }) {
  const { user } = useAuth();
  const [page, setPage] = useState(() => {
    try {
      return Number(localStorage.getItem(mushafPageKey(user?.uid, section))) || 1;
    } catch {
      return 1;
    }
  });

  // Live two-way: the saved page follows the account across devices, and
  // whatever this device has locally is pushed up on mount so the stats
  // panel never sits at zero just because the reader wasn't touched
  // since the cloud sync was added.
  useEffect(() => {
    if (!user?.uid) return;
    const ref = doc(db, "quranPageProgress", `${user.uid}_${section}`);
    let seeded = false;
    const unsub = onSnapshot(ref, (snap) => {
      const remote = snap.data()?.page;
      if (remote) {
        setPage(remote);
        try {
          localStorage.setItem(mushafPageKey(user.uid, section), String(remote));
        } catch {
          // storage unavailable — the live value still applies this session
        }
      } else if (!seeded) {
        seeded = true;
        const local = Number(localStorage.getItem(mushafPageKey(user.uid, section))) || 1;
        setDoc(
          ref,
          { uid: user.uid, email: user.email || null, section, page: local, updatedAt: Date.now() },
          { merge: true }
        ).catch(() => {});
      }
    });
    return unsub;
  }, [user?.uid, user?.email, section]);

  function handlePageChange(next) {
    setPage(next);
    try {
      localStorage.setItem(mushafPageKey(user?.uid, section), String(next));
    } catch {
      // private-browsing / storage-quota — resuming just won't work, no big deal
    }
    // Live-synced to Firestore so the owner's "تقدّم كل المستخدمين" panel in
    // الإعدادات sees exactly where every viewer is in كل من قراءة/حفظ/مراجعة,
    // not just a local bookmark on their own device.
    if (user?.uid) {
      setDoc(
        doc(db, "quranPageProgress", `${user.uid}_${section}`),
        { uid: user.uid, email: user.email || null, section, page: next, updatedAt: Date.now() },
        { merge: true }
      ).catch(() => {});
    }
  }

  const info = getPageInfo(page);

  return (
    <>
      <div className="modal-header">
        <h3>صفحة {page} من المصحف</h3>
        {info && (
          <span className="mushaf-page-meta">
            {info.surahs.map((s) => s.name.replace(/^سُورَةُ\s*/, "")).join(" / ")}
            {" — "}
            الجزء {info.juz.join("-")}
            {" — "}
            {hizbLabel(info.hizbQuarter)}
          </span>
        )}
      </div>
      <QuranPageViewer page={page} onPageChange={handlePageChange} />
    </>
  );
}

export default function Dashboard() {
  const { logout, isAdmin, isSuperadmin, role, user } = useAuth();
  // Push any progress this device recorded before the cloud sync existed,
  // so الإعدادات's stats match what the cards already show.
  useProgressBackfill(user);
  const visibleTabs = isAdmin
    ? TABS.filter((t) => t.key !== "superadmin" || isSuperadmin)
    : TABS.filter(
        (t) => !["students", "overview", "settings", "superadmin"].includes(t.key)
      );
  const savedNav = readNav();
  const [tab, setTab] = useState(savedNav.tab || (isAdmin ? "overview" : "quran"));
  // Always opens on قراءة by design, even if a previous session left a
  // different sub-tab active — only the page-within-mushaf is remembered.
  const [quranSub, setQuranSub] = useState("qiraah");
  const [focusStudentId, setFocusStudentId] = useState(null);
  const [focusAdmin, setFocusAdmin] = useState(null);
  const current = visibleTabs.find((t) => t.key === tab) || visibleTabs[0];

  // Remember where the user was so a refresh doesn't drop them back on the
  // default tab (the role loads asynchronously, so the initial state above
  // can't know yet whether this is an admin).
  useEffect(() => {
    localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify({ tab, quranSub }));
  }, [tab, quranSub]);

  // Once the role resolves, drop a restored tab this user isn't allowed to see.
  useEffect(() => {
    if (!role) return;
    if (!visibleTabs.some((t) => t.key === tab)) setTab(visibleTabs[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, tab]);

  function viewAdmin(adminId, adminName) {
    setFocusAdmin({ id: adminId, name: adminName });
    setTab("students");
  }

  function goToSection(sectionKey, studentId, domain = "quran") {
    setFocusStudentId(studentId);
    if (["hifz", "qiraah", "murajaah"].includes(sectionKey)) {
      if (domain === "hadith") {
        setTab("hadith");
      } else {
        setTab("quran");
        setQuranSub(sectionKey);
      }
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
            <span className="brand-sub">القرآن والسنة</span>
          </div>
          <AdminAlertsBell />
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

        <button
          className="logout-btn"
          onClick={() => {
            localStorage.removeItem(NAV_STORAGE_KEY);
            logout();
          }}
        >
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

        {tab === "quran" && (
          <div className="subnav">
            {SUB_SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={quranSub === s.key ? "subnav-btn active" : "subnav-btn"}
                onClick={() => setQuranSub(s.key)}
              >
                <span className="nav-icon">{ICONS[s.key]}</span>
                {s.label}
              </button>
            ))}
          </div>
        )}

        {tab === "hadith" && <MenhajAccordion />}

        {tab === "overview" && isAdmin && (
          <OverviewDashboard
            onNavigate={goToSection}
            focusAdminId={focusAdmin?.id}
            focusAdminName={focusAdmin?.name}
            onClearFocusAdmin={() => setFocusAdmin(null)}
          />
        )}
        {tab === "superadmin" && isSuperadmin && (
          <SuperadminDashboard onViewAdmin={viewAdmin} />
        )}
        {tab === "students" && isAdmin && (
          <StudentsPanel
            onNavigate={goToSection}
            initialTeacherId={focusAdmin?.id}
            onTeacherFocusHandled={() => setFocusAdmin(null)}
          />
        )}
        {tab === "settings" && isAdmin && <SettingsPanel />}
        {tab === "quran" && (
          <>
            <div className="modal-card quran-page-card public-quran-card mushaf-tab-card">
              <MushafTabReader key={quranSub} section={quranSub} />
            </div>
            <QuranPageTracking
              type={quranSub}
              title={QURAN_TITLES[quranSub]}
              focusStudentId={focusStudentId}
              onFocusHandled={() => setFocusStudentId(null)}
            />
          </>
        )}
        {tab === "attendance" && (
          <AttendancePanel
            focusStudentId={tab === "attendance" ? focusStudentId : null}
            onFocusHandled={() => setFocusStudentId(null)}
          />
        )}
      </main>

      <ScrollButtons />
    </div>
  );
}
