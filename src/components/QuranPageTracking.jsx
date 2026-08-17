import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useCalendar } from "../context/CalendarContext";
import { getPageInfo, hizbLabel } from "../utils/quranPageInfo";
import QuranPageModal from "./QuranPageModal";

const PAGE_COUNT = 604;

// Replaces the old manually-entered records: متابعة المعلم now reads
// straight from quranPageProgress — the exact page each student's own
// mushaf reader last saved, live, per section (قراءة/حفظ/مراجعة). Nothing
// here is entered by hand anymore.
export default function QuranPageTracking({ type, title, focusStudentId, onFocusHandled }) {
  const { isAdmin, isSuperadmin, user } = useAuth();
  const { formatDate } = useCalendar();
  const [students, setStudents] = useState([]);
  const [progress, setProgress] = useState({});
  const [filterStudentId, setFilterStudentId] = useState(null);
  const [search, setSearch] = useState("");
  const [pageView, setPageView] = useState(null);

  useEffect(() => {
    if (!focusStudentId || students.length === 0) return;
    setFilterStudentId(focusStudentId);
    onFocusHandled?.();
  }, [focusStudentId, students]);

  useEffect(() => {
    if (!isAdmin) return;
    const studentsQuery = isSuperadmin
      ? query(collection(db, "students"), orderBy("name"))
      : query(collection(db, "students"), where("adminId", "==", user.uid));
    const unsubStudents = onSnapshot(studentsQuery, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setStudents(rows);
    });

    const progressQuery = query(collection(db, "quranPageProgress"), where("section", "==", type));
    const unsubProgress = onSnapshot(progressQuery, (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        map[d.data().uid] = d.data();
      });
      setProgress(map);
    });

    return () => {
      unsubStudents();
      unsubProgress();
    };
  }, [isAdmin, isSuperadmin, user, type]);

  function studentName(id) {
    return students.find((s) => s.id === id)?.name || "—";
  }

  const visibleStudents = students
    .filter((s) => (filterStudentId ? s.id === filterStudentId : true))
    .filter((s) => (s.name || "").toLowerCase().includes(search.trim().toLowerCase()));

  if (!isAdmin) return null;

  return (
    <div className="panel">
      <h3 className="panel-title">{title}</h3>

      {filterStudentId && (
        <div className="filter-banner">
          <span>
            عرض: <strong>{studentName(filterStudentId)}</strong>
          </span>
          <button type="button" className="ghost" onClick={() => setFilterStudentId(null)}>
            عرض كل الطلاب
          </button>
        </div>
      )}

      {!filterStudentId && students.length > 0 && (
        <div className="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="ابحث عن اسم الطالب..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {visibleStudents.length === 0 ? (
        <p className="empty">لا يوجد طلاب بعد</p>
      ) : (
        <div className="record-grid">
          {visibleStudents.map((s) => {
            const p = progress[s.id];
            const info = p ? getPageInfo(p.page) : null;
            const percent = p ? Math.round((p.page / PAGE_COUNT) * 100) : 0;
            return (
              <div key={s.id} className="record-card">
                <div className="record-card-header">
                  <div className="student-card-avatar record-card-avatar">
                    {s.name?.trim()?.[0] || "?"}
                  </div>
                  <div className="record-card-title">
                    <span className="student-card-name">{s.name}</span>
                    {p?.updatedAt && (
                      <span className="student-card-date">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                        {formatDate(new Date(p.updatedAt).toISOString().slice(0, 10))}
                      </span>
                    )}
                  </div>
                </div>

                {p ? (
                  <>
                    <div
                      className="record-card-unit record-card-unit-clickable"
                      onClick={() => setPageView(p.page)}
                      title="اضغط لعرض صفحة المصحف"
                    >
                      <div>صفحة {p.page} من {PAGE_COUNT}</div>
                      {info && (
                        <div className="record-card-unit-extra">
                          {info.surahs.map((sr) => sr.name.replace(/^سُورَةُ\s*/, "")).join(" / ")} — الجزء{" "}
                          {info.juz.join("-")} · {hizbLabel(info.hizbQuarter)}
                        </div>
                      )}
                    </div>
                    <div className="all-progress-track" style={{ marginTop: 8 }}>
                      <div
                        className="all-progress-fill"
                        style={{
                          width: `${percent}%`,
                          background: percent < 30 ? "#f87171" : percent <= 70 ? "#fbbf24" : "#4ade80",
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <div className="record-card-unit">لم يبدأ الطالب بعد في هذا القسم</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pageView && <QuranPageModal page={pageView} onClose={() => setPageView(null)} />}
    </div>
  );
}
