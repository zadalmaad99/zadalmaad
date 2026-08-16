import { useState } from "react";
import { QuranPageViewer } from "./QuranPageModal";

// Opens straight on the mus-haf (page 1 — الفاتحة), no click needed — safe to
// show anonymous visitors since it carries no student/records data at all.
export default function PublicQuranReader() {
  const [page, setPage] = useState(1);

  return (
    <div className="public-quran-reader">
      <div className="modal-card quran-page-card public-quran-card">
        <div className="modal-header">
          <h3>صفحة {page} من المصحف</h3>
        </div>
        <QuranPageViewer page={page} onPageChange={setPage} />
      </div>

      <p className="public-quran-note">
        لعرض سجلات الحفظ والقراءة والمراجعة الخاصة بالطلاب، يجب تسجيل الدخول كمعلّم أو طالب.
      </p>
    </div>
  );
}
