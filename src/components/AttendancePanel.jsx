import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import HijriDateInput from "./HijriDateInput";
import { useAuth } from "../context/AuthContext";
import { useCalendar } from "../context/CalendarContext";
import { api } from "../api";

const STATUSES = [
  { key: "present", label: "حضور", cls: "status-present" },
  { key: "absent", label: "غياب", cls: "status-absent" },
  { key: "excused", label: "مهلة", cls: "status-excused" },
];

const EMPTY_FORM = {
  studentId: "",
  date: new Date().toISOString().slice(0, 10),
  status: "present",
  notes: "",
};

function statusMeta(key) {
  return STATUSES.find((s) => s.key === key) || STATUSES[0];
}

export default function AttendancePanel({ focusStudentId, onFocusHandled }) {
  const { isAdmin } = useAuth();
  const { formatDate, calendar } = useCalendar();
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [filterStudentId, setFilterStudentId] = useState(null);
  const formRef = useRef(null);

  useEffect(() => {
    if (!focusStudentId || students.length === 0) return;
    setFormOpen(true);
    setFilterStudentId(focusStudentId);
    setForm((f) => ({ ...f, studentId: focusStudentId }));
    setTimeout(
      () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50
    );
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
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setRecords(list);
    });

    return () => {
      unsubStudents();
      unsubAttendance();
    };
  }, [isAdmin]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
    setFormOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.studentId) return;
    setError("");

    const payload = {
      studentId: form.studentId,
      date: form.date,
      status: form.status,
      notes: form.notes.trim(),
    };

    const existing = records.find(
      (r) =>
        r.studentId === payload.studentId &&
        r.date === payload.date &&
        r.id !== editingId
    );

    try {
      if (existing) {
        await api.updateAttendance(existing.id, payload);
        if (editingId && editingId !== existing.id) {
          await api.deleteAttendance(editingId);
        }
      } else if (editingId) {
        await api.updateAttendance(editingId, payload);
      } else {
        await api.createAttendance(payload);
      }
      resetForm();
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء الحفظ");
    }
  }

  function startEdit(r) {
    setFormOpen(true);
    setTimeout(
      () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50
    );
    setEditingId(r.id);
    setForm({
      studentId: r.studentId,
      date: r.date,
      status: r.status,
      notes: r.notes || "",
    });
  }

  async function handleDelete(id) {
    if (!confirm("هل أنت متأكد من حذف هذا السجل؟")) return;
    await api.deleteAttendance(id);
  }

  function studentName(id) {
    return students.find((s) => s.id === id)?.name || "—";
  }

  const visibleRecords = filterStudentId
    ? records.filter((r) => r.studentId === filterStudentId)
    : records;

  const groupedByDate = [];
  for (const r of visibleRecords) {
    const bucket = groupedByDate.find(([date]) => date === r.date);
    if (bucket) bucket[1].push(r);
    else groupedByDate.push([r.date, [r]]);
  }

  const summary = students.map((s) => {
    const own = records.filter((r) => r.studentId === s.id);
    return {
      id: s.id,
      name: s.name,
      present: own.filter((r) => r.status === "present").length,
      absent: own.filter((r) => r.status === "absent").length,
      excused: own.filter((r) => r.status === "excused").length,
    };
  });

  return (
    <div className="panel">
      {filterStudentId && (
        <div className="filter-banner">
          <span>
            عرض سجلات: <strong>{studentName(filterStudentId)}</strong>
          </span>
          <button type="button" className="ghost" onClick={() => setFilterStudentId(null)}>
            عرض كل الطلاب
          </button>
        </div>
      )}

      {summary.length > 0 && (
        <div className="attendance-summary">
          {summary.map((s) => (
            <div key={s.id} className="attendance-summary-card">
              <span className="attendance-summary-name">{s.name}</span>
              <div className="attendance-summary-counts">
                <span className="status-badge status-present">{s.present} حضور</span>
                <span className="status-badge status-absent">{s.absent} غياب</span>
                <span className="status-badge status-excused">{s.excused} مهلة</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <div className="collapsible">
          <button
            type="button"
            className="collapsible-toggle"
            onClick={() => setFormOpen((v) => !v)}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={formOpen ? "chevron chevron-open" : "chevron"}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            تسجيل حضور
          </button>

          {formOpen && (
            <form className="record-form" onSubmit={handleSubmit} ref={formRef}>
              <div className="picker-row">
                <label>
                  الطالب
                  <select
                    value={form.studentId}
                    onChange={(e) => setForm({ ...form, studentId: e.target.value })}
                    required
                  >
                    <option value="">اختر الطالب</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  التاريخ
                  {calendar === "hijri" ? (
                    <HijriDateInput
                      value={form.date}
                      onChange={(v) => setForm({ ...form, date: v })}
                    />
                  ) : (
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                      required
                    />
                  )}
                </label>
              </div>

              <div className="contact-toggle">
                <span className="contact-toggle-label">الحالة</span>
                <div className="contact-toggle-options">
                  {STATUSES.map((s) => (
                    <label className="radio-label" key={s.key}>
                      <input
                        type="radio"
                        name="status"
                        checked={form.status === s.key}
                        onChange={() => setForm({ ...form, status: s.key })}
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>

              <label>
                ملاحظات
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </label>

              {error && <div className="error-box">{error}</div>}

              <div className="form-actions">
                <button type="submit">{editingId ? "حفظ التعديل" : "تسجيل"}</button>
                {editingId && (
                  <button type="button" className="ghost" onClick={resetForm}>
                    إلغاء
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {visibleRecords.length === 0 ? (
        <p className="empty">لا توجد سجلات حضور بعد</p>
      ) : (
        <div className="day-groups">
          {groupedByDate.map(([date, dayRecords]) => (
            <div key={date} className="day-group">
              <div className="day-group-header">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                {formatDate(date)}
                <span className="day-group-count">{dayRecords.length} طالب</span>
              </div>

              <div className="day-group-rows">
                {dayRecords.map((r) => (
                  <div key={r.id} className="day-row">
                    <div className="day-row-student">
                      <div className="student-card-avatar record-card-avatar">
                        {studentName(r.studentId)?.trim()?.[0] || "?"}
                      </div>
                      <span className="student-card-name">
                        {studentName(r.studentId)}
                      </span>
                    </div>

                    <span className={`status-badge ${statusMeta(r.status).cls}`}>
                      {statusMeta(r.status).label}
                    </span>

                    {r.notes && <div className="day-row-notes">{r.notes}</div>}

                    {isAdmin && (
                      <div className="day-row-actions">
                        <button className="ghost" onClick={() => startEdit(r)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button className="danger" onClick={() => handleDelete(r.id)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
