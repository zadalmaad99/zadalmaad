import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useCalendar } from "../context/CalendarContext";
import { gregorianToHijri } from "../data/hijri";
import { api } from "../api";

const STATUS_LABELS = {
  present: "حضور",
  absent: "غياب",
  excused: "مهلة",
};

function pad(n) {
  return String(n).padStart(2, "0");
}

function toIso(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function addMonths(year, month, delta) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function monthYearLabel(year, month) {
  const hijri = gregorianToHijri(toIso(year, month, 1));
  return `شهر ${month + 1} — ${year} م  —  شهر ${hijri.month} — ${hijri.year} هـ`;
}

export default function AttendancePanel({ focusStudentId, onFocusHandled }) {
  const { isAdmin } = useAuth();
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const today = new Date();
  const [cursor, setCursor] = useState({
    year: today.getFullYear(),
    month: today.getMonth(),
  });
  const [filterStudentId, setFilterStudentId] = useState(null);
  const [search, setSearch] = useState("");

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

  const dayCount = daysInMonth(cursor.year, cursor.month);
  const dayNumbers = Array.from({ length: dayCount }, (_, i) => i + 1);
  const isCurrentMonth =
    cursor.year === today.getFullYear() && cursor.month === today.getMonth();

  async function setStatus(studentId, dateIso, status) {
    const existing = records.find(
      (r) => r.studentId === studentId && r.date === dateIso
    );
    try {
      if (!status) {
        if (existing) await api.deleteAttendance(existing.id);
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
      ?.status || "";
  }

  const visibleStudents = students
    .filter((s) => (filterStudentId ? s.id === filterStudentId : true))
    .filter((s) => s.name?.toLowerCase().includes(search.trim().toLowerCase()));

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

      {isAdmin && !filterStudentId && (
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

      <div className="week-nav">
        <button
          type="button"
          className="ghost"
          onClick={() => setCursor((c) => addMonths(c.year, c.month, -1))}
        >
          الشهر السابق
        </button>
        <div className="week-range">
          <div>{monthYearLabel(cursor.year, cursor.month)}</div>
        </div>
        <button
          type="button"
          className="ghost"
          onClick={() => setCursor((c) => addMonths(c.year, c.month, 1))}
          disabled={isCurrentMonth}
        >
          الشهر التالي
        </button>
      </div>

      {visibleStudents.length === 0 ? (
        <p className="empty">لا يوجد طلاب</p>
      ) : (
        <div className="month-table-wrap">
          <table className="month-table">
            <thead>
              <tr>
                <th className="month-name-col">الاسم</th>
                {dayNumbers.map((d) => (
                  <th key={d}>{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleStudents.map((s) => (
                <tr key={s.id}>
                  <td className="month-name-col month-name-cell">{s.name}</td>
                  {dayNumbers.map((d) => {
                    const iso = toIso(cursor.year, cursor.month, d);
                    const status = statusOf(s.id, iso);
                    return (
                      <td key={d}>
                        <select
                          disabled={!isAdmin}
                          value={status}
                          className={status ? `month-select month-select-${status}` : "month-select"}
                          onChange={(e) => {
                            setStatus(s.id, iso, e.target.value);
                            e.target.blur();
                          }}
                          onWheel={(e) => e.target.blur()}
                        >
                          <option value="">—</option>
                          <option value="present">{STATUS_LABELS.present}</option>
                          <option value="absent">{STATUS_LABELS.absent}</option>
                          <option value="excused">{STATUS_LABELS.excused}</option>
                        </select>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
