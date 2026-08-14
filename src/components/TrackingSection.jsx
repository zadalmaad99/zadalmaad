import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { SURAHS } from "../data/surahs";
import { locateAyah } from "../data/quranBoundaries";
import UnitPicker from "./UnitPicker";
import HijriDateInput from "./HijriDateInput";
import ReportModal from "./ReportModal";
import QuranPageModal from "./QuranPageModal";
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

function unitParts(r) {
  const base = `${r.surahNumber}. ${r.surahName} (${r.ayahFrom} - ${r.ayahTo})`;
  const extra = r.juz ? `الجزء ${r.juz}، الحزب ${r.hizb}، صفحة ${r.page}` : "";
  return { base, extra };
}

export default function TrackingSection({
  type,
  title,
  focusStudentId,
  onFocusHandled,
}) {
  const { isAdmin, isSuperadmin, user } = useAuth();
  const { formatDate, calendar } = useCalendar();
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [reportRecord, setReportRecord] = useState(null);
  const [pageView, setPageView] = useState(null);
  const [filterStudentId, setFilterStudentId] = useState(null);
  const [search, setSearch] = useState("");
  const formRef = useRef(null);

  useEffect(() => {
    if (!focusStudentId || students.length === 0) return;
    setFilterStudentId(focusStudentId);
    setForm((f) => ({ ...f, studentId: focusStudentId }));
    onFocusHandled?.();
  }, [focusStudentId, students]);

  useEffect(() => {
    const studentsQuery = isSuperadmin
      ? query(collection(db, "students"), orderBy("name"))
      : isAdmin
        ? query(collection(db, "students"), where("adminId", "==", user.uid), orderBy("name"))
        : query(collection(db, "students"), where("__name__", "==", auth.currentUser.uid));
    const unsubStudents = onSnapshot(studentsQuery, (snap) =>
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    const recordsQuery = isSuperadmin
      ? query(collection(db, "records"), where("type", "==", type))
      : isAdmin
        ? query(
            collection(db, "records"),
            where("type", "==", type),
            where("adminId", "==", user.uid)
          )
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
  }, [type, isAdmin, isSuperadmin, user]);

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
    try {
      await api.deleteRecord(id);
    } catch (err) {
      alert(err.message || "تعذّر حذف السجل");
    }
  }

  function studentName(id) {
    return students.find((s) => s.id === id)?.name || "—";
  }

  const visibleRecords = records
    .filter((r) => (filterStudentId ? r.studentId === filterStudentId : true))
    .filter((r) =>
      studentName(r.studentId).toLowerCase().includes(search.trim().toLowerCase())
    );

  return (
    <div className="panel">
      <h3 className="panel-title">{title}</h3>

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

      {!filterStudentId && records.length > 0 && (
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

      {visibleRecords.length === 0 ? (
        <p className="empty">لا توجد سجلات بعد</p>
      ) : (
        <div className="record-grid">
          {visibleRecords.map((r) => (
            <div key={r.id} className="record-card">
              <div className="record-card-header">
                <div className="student-card-avatar record-card-avatar">
                  {studentName(r.studentId)?.trim()?.[0] || "?"}
                </div>
                <div className="record-card-title">
                  <span className="student-card-name">
                    {studentName(r.studentId)}
                  </span>
                  <span className="student-card-date">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                    {formatDate(r.date)}
                  </span>
                </div>
              </div>

              <div
                className={
                  r.page ? "record-card-unit record-card-unit-clickable" : "record-card-unit"
                }
                onClick={() => r.page && setPageView(r.page)}
                title={r.page ? "اضغط لعرض صفحة المصحف" : undefined}
              >
                <div>{unitParts(r).base}</div>
                {unitParts(r).extra && (
                  <div className="record-card-unit-extra">{unitParts(r).extra}</div>
                )}
              </div>
              {r.notes && <div className="record-card-notes">{r.notes}</div>}

              <div className="student-card-actions">
                <button className="ghost" onClick={() => setReportRecord(r)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 20V10M11 20V4M18 20v-7" />
                  </svg>
                  تقرير
                </button>
                {isAdmin && (
                  <>
                    <button className="ghost" onClick={() => startEdit(r)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                      تعديل
                    </button>
                    <button className="danger" onClick={() => handleDelete(r.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
                      </svg>
                      حذف
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {reportRecord && (
        <ReportModal
          record={reportRecord}
          studentName={studentName(reportRecord.studentId)}
          onClose={() => setReportRecord(null)}
        />
      )}

      {pageView && (
        <QuranPageModal page={pageView} onClose={() => setPageView(null)} />
      )}
    </div>
  );
}
