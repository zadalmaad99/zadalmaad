import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useCalendar } from "../context/CalendarContext";
import { api } from "../api";

const DAY_NAMES = [
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

function toIso(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getWeekDates(weekOffset) {
  const today = new Date();
  const day = today.getDay(); // 0=Sun..6=Sat
  const diffToSaturday = (day + 1) % 7;
  const saturday = new Date(today);
  saturday.setDate(today.getDate() - diffToSaturday + weekOffset * 7);
  saturday.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(saturday);
    d.setDate(saturday.getDate() + i);
    return d;
  });
}

export default function AttendancePanel({ focusStudentId, onFocusHandled }) {
  const { isAdmin } = useAuth();
  const { formatBoth } = useCalendar();
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [filterStudentId, setFilterStudentId] = useState(null);

  useEffect(() => {
    if (!focusStudentId || students.length === 0) return;
    setFilterStudentId(focusStudentId);
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

  const weekDates = getWeekDates(weekOffset);

  async function setStatus(studentId, dateIso, status) {
    const existing = records.find(
      (r) => r.studentId === studentId && r.date === dateIso
    );
    try {
      if (existing && existing.status === status) {
        await api.deleteAttendance(existing.id);
      } else if (existing) {
        await api.updateAttendance(existing.id, {
          studentId,
          date: dateIso,
          status,
          notes: existing.notes || "",
        });
      } else {
        await api.createAttendance({ studentId, date: dateIso, status, notes: "" });
      }
    } catch (err) {
      alert(err.message || "تعذّر حفظ الحضور");
    }
  }

  function statusOf(studentId, dateIso) {
    return records.find((r) => r.studentId === studentId && r.date === dateIso)
      ?.status;
  }

  const visibleStudents = filterStudentId
    ? students.filter((s) => s.id === filterStudentId)
    : students;

  return (
    <div className="panel">
      {filterStudentId && (
        <div className="filter-banner">
          <span>
            عرض سجلات:{" "}
            <strong>{students.find((s) => s.id === filterStudentId)?.name}</strong>
          </span>
          <button type="button" className="ghost" onClick={() => setFilterStudentId(null)}>
            عرض كل الطلاب
          </button>
        </div>
      )}

      <div className="week-nav">
        <button type="button" className="ghost" onClick={() => setWeekOffset((w) => w - 1)}>
          الأسبوع السابق
        </button>
        <div className="week-range">
          <div>{formatBoth(toIso(weekDates[0]))}</div>
          <span>إلى</span>
          <div>{formatBoth(toIso(weekDates[6]))}</div>
        </div>
        <button
          type="button"
          className="ghost"
          onClick={() => setWeekOffset((w) => w + 1)}
          disabled={weekOffset >= 0}
        >
          الأسبوع التالي
        </button>
      </div>

      {visibleStudents.length === 0 ? (
        <p className="empty">لا يوجد طلاب</p>
      ) : (
        <div className="attendance-week-list">
          {visibleStudents.map((s) => (
            <div key={s.id} className="attendance-week-card">
              <div className="student-card-header">
                <div className="student-card-avatar">{s.name?.trim()?.[0] || "?"}</div>
                <div className="student-card-name">{s.name}</div>
              </div>

              <table className="week-table">
                <thead>
                  <tr>
                    <th>اليوم</th>
                    <th>حضور</th>
                    <th>غياب</th>
                    <th>مهلة</th>
                  </tr>
                </thead>
                <tbody>
                  {weekDates.map((d, i) => {
                    const iso = toIso(d);
                    const status = statusOf(s.id, iso);
                    return (
                      <tr key={iso}>
                        <td className="week-day-cell">
                          <span className="week-day-name">{DAY_NAMES[i]}</span>
                          <span className="week-day-date">{formatBoth(iso)}</span>
                        </td>
                        <td>
                          <button
                            type="button"
                            disabled={!isAdmin}
                            className={
                              status === "present"
                                ? "week-toggle week-toggle-present-active"
                                : "week-toggle"
                            }
                            onClick={() => setStatus(s.id, iso, "present")}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          </button>
                        </td>
                        <td>
                          <button
                            type="button"
                            disabled={!isAdmin}
                            className={
                              status === "absent"
                                ? "week-toggle week-toggle-absent-active"
                                : "week-toggle"
                            }
                            onClick={() => setStatus(s.id, iso, "absent")}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </td>
                        <td>
                          <input
                            type="radio"
                            disabled={!isAdmin}
                            checked={status === "excused"}
                            onChange={() => setStatus(s.id, iso, "excused")}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
