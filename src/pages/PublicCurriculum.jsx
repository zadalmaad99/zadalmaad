import { Link } from "react-router-dom";
import MenhajAccordion from "../components/MenhajAccordion";
import logo from "../assets/logo.png";

// Public, read-only view of المنهج for visitors who aren't logged in — the
// book cards themselves already hide edit controls and per-student tracking
// when there's no signed-in user, so this just wraps them with a header.
export default function PublicCurriculum() {
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

      <main className="public-curriculum-body">
        <MenhajAccordion />
      </main>
    </div>
  );
}
