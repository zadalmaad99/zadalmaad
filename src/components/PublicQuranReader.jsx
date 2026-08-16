import { useState } from "react";
import QuranPageModal from "./QuranPageModal";

// A page-turner for the mus-haf that needs no student/records data at all —
// safe to show to anonymous visitors, unlike the حفظ/قراءة/مراجعة tracking
// (which lists real students' names and private records).
export default function PublicQuranReader() {
  const [open, setOpen] = useState(false);

  return (
    <div className="public-quran-reader">
      <div className="menhaj-card public-quran-card">
        <div className="menhaj-card-top">
          <span className="menhaj-card-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
            </svg>
          </span>
          <span className="menhaj-card-heading">
            <span className="menhaj-card-title">تصفّح المصحف الشريف</span>
            <span className="menhaj-card-subtitle">
              604 صفحة — رواية حفص عن عاصم، برواية المصحف المدني
            </span>
          </span>
        </div>
        <button type="button" className="public-quran-open-btn" onClick={() => setOpen(true)}>
          فتح المصحف
        </button>
      </div>

      <p className="public-quran-note">
        لعرض سجلات الحفظ والقراءة والمراجعة الخاصة بالطلاب، يجب تسجيل الدخول كمعلّم أو طالب.
      </p>

      {open && <QuranPageModal page={1} onClose={() => setOpen(false)} />}
    </div>
  );
}
