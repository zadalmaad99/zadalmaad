import { useState } from "react";
import { Link } from "react-router-dom";
import MenhajAccordion from "../components/MenhajAccordion";
import SettingsPanel from "../components/SettingsPanel";
import logo from "../assets/logo.png";

const TABS = [
  { key: "menhaj", label: "المنهج" },
  { key: "settings", label: "الإعدادات" },
];

// Public, read-only view for visitors who aren't logged in. المنهج is fully
// open (شرح بالصوت + PDF — the book cards already hide edit controls and
// per-student tracking with no signed-in user). Settings only ever exposes
// theme/calendar preferences here — its superadmin curriculum-upload card
// is self-gated inside SettingsPanel, so nothing private leaks through.
export default function PublicCurriculum() {
  const [tab, setTab] = useState("menhaj");

  return (
    <div className="public-curriculum">
      <header className="public-curriculum-header">
        <img src={logo} alt="شعار التطبيق" className="public-curriculum-logo" />
        <div className="public-curriculum-heading">
          <h1>زاد المعاد</h1>
          <p>المنهج الدراسي — كتب، شروح صوتية، وملفات PDF</p>
        </div>
        <Link to="/login" className="public-curriculum-login">
          تسجيل الدخول
        </Link>
      </header>

      <nav className="public-curriculum-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={tab === t.key ? "subnav-btn active" : "subnav-btn"}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="public-curriculum-body">
        {tab === "menhaj" && <MenhajAccordion />}
        {tab === "settings" && <SettingsPanel />}
      </main>
    </div>
  );
}
