import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { gregorianToHijri } from "../data/hijri";
import { api } from "../api";

const STATUS_LABELS = {
  present: "حضور",
  absent: "غياب",
  excused: "مهلة",
};

const WEEKDAY_NAMES = [
  "السبت",
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
];

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateToIso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoToDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDaysIso(iso, delta) {
  const d = isoToDate(iso);
  d.setDate(d.getDate() + delta);
  return dateToIso(d);
}

function saturdayOf(iso) {
  const d = isoToDate(iso);
  const offset = (d.getDay() + 1) % 7; // days since last Saturday
  d.setDate(d.getDate() - offset);
  return dateToIso(d);
}

function dateBoth(iso) {
  const d = isoToDate(iso);
  const hijri = gregorianToHijri(iso);
  return {
    gregorian: `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} م`,
    hijri: `${hijri.day}/${hijri.month}/${hijri.year} هـ`,
  };
}

export default function AttendancePanel({ focusStudentId, onFocusHandled }) {
  const { isAdmin } = useAuth();
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const todayIso = dateToIso(new Date());
  const [selectedId, setSelectedId] = useState(null);
  const [blockStart, setBlockStart] = useState(saturdayOf(todayIso));
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!focusStudentId || students.length === 0) return;
    setSelectedId(focusStudentId);
    onFocusHandled?.();
  }, [focusStudentId, students]);

  useEffect(() => {
    const studentsQuery = isAdmin
      ? query(collection(db, "students"), orderBy("name"))
      : query(collection(db, "students"), where("__name__", "==", auth.currentUser.uid));
    const unsubStudents = onSnapshot(studentsQuery, (snap) =>
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const attendanceQuery = isAdmin
      ? collection(db, "attendance")
      : query(
          collection(db, "attendance"),
          where("studentId", "==", auth.currentUser.uid)
        );
    const unsubAttendance = onSnapshot(attendanceQuery, (snap) => {
      setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsubStudents();
      unsubAttendance();
    };
  }, [isAdmin]);

  async function setStatus(studentId, dateIso, status) {
    const existing = records.find(
      (r) => r.studentId === studentId && r.date === dateIso
    );
    try {
      if (!status) {
        if (existing) {
          await api.deleteAttendance(existing.id);
          setRecords((rs) => rs.filter((r) => r.id !== existing.id));
        }
      } else if (existing) {
        await api.updateAttendance(existing.id, {
          studentId,
          date: dateIso,
          status,
          notes: existing.notes || "",
        });
        setRecords((rs) =>
          rs.map((r) => (r.id === existing.id ? { ...r, status } : r))
        );
      } else {
        const { id } = await api.createAttendance({
          studentId,
          date: dateIso,
          status,
          notes: "",
        });
        setRecords((rs) => [
          ...rs,
          { id, studentId, date: dateIso, status, notes: "" },
        ]);
      }
    } catch (err) {
      alert(err.message || "تعذّر حفظ الحضور");
    }
  }

  function statusOf(studentId, dateIso) {
    return records.find((r) => r.studentId === studentId && r.date === dateIso)
      ?.status || "";
  }

  const visibleStudents = students.filter((s) =>
    s.name?.toLowerCase().includes(search.trim().toLowerCase())
  );
  const selectedStudent = students.find((s) => s.id === selectedId);

  const todaySaturday = saturdayOf(todayIso);
  const isCurrentBlock = blockStart === todaySaturday;

  const weeks = [0, 1, 2, 3].map((w) => {
    const weekStartIso = addDaysIso(blockStart, w * 7);
    const days = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStartIso, i));
    return { weekStartIso, days };
  });

  return (
    <div className="panel">
      {!selectedStudent ? (
        <>
          {students.length > 0 && (
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
            <p className="empty">لا يوجد طلاب</p>
          ) : (
            <div className="attendance-student-list">
              {visibleStudents.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="attendance-student-item"
                  onClick={() => setSelectedId(s.id)}
                >
                  <span className="student-card-avatar">
                    {s.name?.trim()?.[0] || "?"}
                  </span>
                  <span className="attendance-student-name">{s.name}</span>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="filter-banner">
            <span>
              سجل حضور: <strong>{selectedStudent.name}</strong>
            </span>
            <button type="button" className="ghost" onClick={() => setSelectedId(null)}>
              عرض كل الطلاب
            </button>
          </div>

          <div className="week-nav">
            <button
              type="button"
              className="ghost"
              onClick={() => setBlockStart((b) => addDaysIso(b, -28))}
            >
              الأسابيع السابقة
            </button>
            <div className="week-range">
              <div className="week-range-line">
                <span>{dateBoth(blockStart).gregorian}</span>
                <span>{dateBoth(blockStart).hijri}</span>
              </div>
              <span className="week-range-arrow">إلى</span>
              <div className="week-range-line">
                <span>{dateBoth(addDaysIso(blockStart, 27)).gregorian}</span>
                <span>{dateBoth(addDaysIso(blockStart, 27)).hijri}</span>
              </div>
            </div>
            <button
              type="button"
              className="ghost"
              onClick={() => setBlockStart((b) => addDaysIso(b, 28))}
              disabled={isCurrentBlock}
            >
              الأسابيع التالية
            </button>
          </div>

          <div className="attendance-weeks">
            {weeks.map((week, wi) => (
              <div key={week.weekStartIso} className="attendance-week-block">
                <div className="attendance-week-title">
                  <span className="attendance-week-number">الأسبوع {wi + 1}</span>
                  <span className="attendance-week-dates">
                    {dateBoth(week.weekStartIso).gregorian} · {dateBoth(week.weekStartIso).hijri}
                    {" "}إلى{" "}
                    {dateBoth(week.days[6]).gregorian} · {dateBoth(week.days[6]).hijri}
                  </span>
                </div>
                <div className="attendance-week-grid">
                  {week.days.map((iso, di) => {
                    const status = statusOf(selectedStudent.id, iso);
                    const d = isoToDate(iso);
                    const isFuture = iso > todayIso;
                    return (
                      <div
                        key={iso}
                        className={isFuture ? "attendance-day-cell attendance-day-future" : "attendance-day-cell"}
                      >
                        <div className="attendance-day-label">
                          <span className="attendance-day-weekday">{WEEKDAY_NAMES[di]}</span>
                          <span className="attendance-day-date">{d.getDate()}/{d.getMonth() + 1}</span>
                        </div>
                        <select
                          disabled={!isAdmin || isFuture}
                          value={status}
                          className={status ? `month-select month-select-${status}` : "month-select"}
                          onChange={(e) => {
                            setStatus(selectedStudent.id, iso, e.target.value);
                            e.target.blur();
                          }}
                          onWheel={(e) => e.target.blur()}
                        >
                          <option value="">—</option>
                          <option value="present">{STATUS_LABELS.present}</option>
                          <option value="absent">{STATUS_LABELS.absent}</option>
                          <option value="excused">{STATUS_LABELS.excused}</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
