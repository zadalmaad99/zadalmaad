import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { SURAHS } from "../data/surahs";
import { locateAyah } from "../data/quranBoundaries";
import UnitPicker from "./UnitPicker";
import SurahProgressBar from "./SurahProgressBar";
import HijriDateInput from "./HijriDateInput";
import { useAuth } from "../context/AuthContext";
import { useCalendar } from "../context/CalendarContext";
import { api } from "../api";

const EMPTY_FORM = {
  studentId: "",
  surahNumber: "",
  ayahFrom: 1,
  ayahTo: 1,
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

function unitLabel(r) {
  const base = `${r.surahNumber}. ${r.surahName} (${r.ayahFrom} - ${r.ayahTo})`;
  if (r.juz) return `${base} — الجزء ${r.juz}، الحزب ${r.hizb}، صفحة ${r.page}`;
  return base;
}

export default function TrackingSection({
  type,
  title,
  focusStudentId,
  onFocusHandled,
}) {
  const { isAdmin } = useAuth();
  const { formatDate, calendar } = useCalendar();
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [highlightId, setHighlightId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const formRef = useRef(null);

  useEffect(() => {
    if (!focusStudentId || students.length === 0) return;
    const el = document.getElementById(`progress-${focusStudentId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setHighlightId(focusStudentId);
      onFocusHandled?.();
      const timer = setTimeout(() => setHighlightId(null), 2500);
      return () => clearTimeout(timer);
    }
  }, [focusStudentId, students]);

  useEffect(() => {
    const studentsQuery = isAdmin
      ? query(collection(db, "students"), orderBy("name"))
      : query(collection(db, "students"), where("__name__", "==", auth.currentUser.uid));
    const unsubStudents = onSnapshot(studentsQuery, (snap) =>
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const recordsQuery = isAdmin
      ? query(collection(db, "records"), where("type", "==", type))
      : query(
          collection(db, "records"),
          where("type", "==", type),
          where("studentId", "==", auth.currentUser.uid)
        );
    const unsubRecords = onSnapshot(recordsQuery, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setRecords(list);
    });

    return () => {
      unsubStudents();
      unsubRecords();
    };
  }, [type, isAdmin]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError("");
    setFormOpen(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.studentId || !form.surahNumber) return;
    setError("");

    const surah = SURAHS.find((s) => s.number === Number(form.surahNumber));
    const surahNumber = Number(form.surahNumber);
    let ayahFrom = Number(form.ayahFrom);
    let ayahTo = Number(form.ayahTo);

    const otherExisting = records.find(
      (r) =>
        r.studentId === form.studentId &&
        r.surahNumber === surahNumber &&
        r.id !== editingId
    );

    // Only merge when adding fresh progress for a surah that already has a
    // record (extend coverage). Editing an existing record replaces its
    // range with exactly what was entered - it's a correction, not a merge.
    if (otherExisting && !editingId) {
      ayahFrom = Math.min(otherExisting.ayahFrom, ayahFrom);
      ayahTo = Math.max(otherExisting.ayahTo, ayahTo);
    }

    const location = locateAyah(surahNumber, ayahTo);
    const payload = {
      type,
      studentId: form.studentId,
      surahNumber,
      surahName: surah?.name || "",
      ayahFrom,
      ayahTo,
      juz: location.juz,
      hizb: location.hizb,
      page: location.page,
      date: form.date,
      notes: form.notes.trim(),
    };

    try {
      if (otherExisting) {
        await api.updateRecord(otherExisting.id, payload);
        if (editingId && editingId !== otherExisting.id) {
          await api.deleteRecord(editingId);
        }
      } else if (editingId) {
        await api.updateRecord(editingId, payload);
      } else {
        await api.createRecord(payload);
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
      surahNumber: r.surahNumber || "",
      ayahFrom: r.ayahFrom || 1,
      ayahTo: r.ayahTo || 1,
      date: r.date,
      notes: r.notes || "",
    });
  }

  async function handleDelete(id) {
    if (!confirm("هل أنت متأكد من حذف هذا السجل؟")) return;
    await api.deleteRecord(id);
  }

  function studentName(id) {
    return students.find((s) => s.id === id)?.name || "—";
  }

  function coveredSurahsFor(studentId) {
    const set = new Set();
    for (const r of records) {
      if (r.studentId === studentId) set.add(r.surahNumber);
    }
    return set;
  }

  return (
    <div className="panel">
      <h3 className="panel-title">{title}</h3>

      {students.length > 0 && (
        <div className="progress-grid">
          {students.map((s) => (
            <div
              key={s.id}
              id={`progress-${s.id}`}
              className={
                s.id === highlightId
                  ? "student-card progress-card progress-card-focus"
                  : "student-card progress-card"
              }
            >
              <div className="student-card-header">
                <div className="student-card-avatar">
                  {s.name?.trim()?.[0] || "?"}
                </div>
                <div className="student-card-name">{s.name}</div>
              </div>
              <SurahProgressBar coveredNumbers={coveredSurahsFor(s.id)} />
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
            إضافة سجل
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

          <UnitPicker form={form} onChange={(vals) => setForm({ ...form, ...vals })} />

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
            <button type="submit">{editingId ? "حفظ التعديل" : "إضافة سجل"}</button>
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

      <table>
        <thead>
          <tr>
            <th>الطالب</th>
            <th>الوحدة</th>
            <th>التاريخ</th>
            <th>ملاحظات</th>
            {isAdmin && <th>إجراءات</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td>{studentName(r.studentId)}</td>
              <td>{unitLabel(r)}</td>
              <td>{formatDate(r.date)}</td>
              <td>{r.notes || "—"}</td>
              {isAdmin && (
                <td className="actions">
                  <button className="ghost" onClick={() => startEdit(r)}>
                    تعديل
                  </button>
                  <button className="danger" onClick={() => handleDelete(r.id)}>
                    حذف
                  </button>
                </td>
              )}
            </tr>
          ))}
          {records.length === 0 && (
            <tr>
              <td colSpan={isAdmin ? 5 : 4} className="empty">
                لا توجد سجلات بعد
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
