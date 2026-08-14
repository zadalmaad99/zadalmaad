import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { HADITH_BOOKS } from "../data/hadithBooks";
import HijriDateInput from "./HijriDateInput";
import HadithReportModal from "./HadithReportModal";
import { useAuth } from "../context/AuthContext";
import { useCalendar } from "../context/CalendarContext";
import { api } from "../api";

const EMPTY_FORM = {
  studentId: "",
  book: "",
  hadithNumber: 1,
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function HadithTrackingSection({
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
        ? query(collection(db, "students"), where("adminId", "==", user.uid))
        : query(collection(db, "students"), where("__name__", "==", auth.currentUser.uid));
    const unsubStudents = onSnapshot(studentsQuery, (snap) => {
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (isAdmin && !isSuperadmin) rows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      setStudents(rows);
    });

    const recordsQuery = isSuperadmin
      ? query(collection(db, "hadithRecords"), where("type", "==", type))
      : isAdmin
        ? query(
            collection(db, "hadithRecords"),
            where("type", "==", type),
            where("adminId", "==", user.uid)
          )
        : query(
            collection(db, "hadithRecords"),
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
    if (!form.studentId || !form.book) return;
    setError("");

    const bookInfo = HADITH_BOOKS.find((b) => b.key === form.book);
    let hadithNumber = Number(form.hadithNumber);

    const otherExisting = records.find(
      (r) =>
        r.studentId === form.studentId &&
        r.book === form.book &&
        r.id !== editingId
    );

    if (otherExisting && !editingId) {
      hadithNumber = Math.max(otherExisting.hadithNumber, hadithNumber);
    }

    const payload = {
      type,
      studentId: form.studentId,
      book: form.book,
      bookName: bookInfo?.name || "",
      hadithNumber,
      date: form.date,
      notes: form.notes.trim(),
    };

    try {
      if (otherExisting) {
        await api.updateHadithRecord(otherExisting.id, payload);
        if (editingId && editingId !== otherExisting.id) {
          await api.deleteHadithRecord(editingId);
        }
      } else if (editingId) {
        await api.updateHadithRecord(editingId, payload);
      } else {
        await api.createHadithRecord(payload);
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
      book: r.book || "",
      hadithNumber: r.hadithNumber || 1,
      date: r.date,
      notes: r.notes || "",
    });
  }

  async function handleDelete(id) {
    if (!confirm("هل أنت متأكد من حذف هذا السجل؟")) return;
    try {
      await api.deleteHadithRecord(id);
    } catch (err) {
      alert(err.message || "تعذّر حذف السجل");
    }
  }

  function studentName(id) {
    return students.find((s) => s.id === id)?.name || "—";
  }

  const selectedBook = HADITH_BOOKS.find((b) => b.key === form.book);

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

              <div className="picker-row">
                <label>
                  الكتاب
                  <select
                    value={form.book}
                    onChange={(e) =>
                      setForm({ ...form, book: e.target.value, hadithNumber: 1 })
                    }
                    required
                  >
                    <option value="">اختر الكتاب</option>
                    {HADITH_BOOKS.map((b) => (
                      <option key={b.key} value={b.key}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  رقم الحديث
                  <input
                    type="number"
                    min={1}
                    max={selectedBook?.total || undefined}
                    value={form.hadithNumber}
                    onChange={(e) =>
                      setForm({ ...form, hadithNumber: e.target.value })
                    }
                    required
                  />
                </label>
              </div>
              {selectedBook && (
                <p className="hint-text">
                  إجمالي أحاديث {selectedBook.name}: {selectedBook.total}
                </p>
              )}

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
          {visibleRecords.map((r) => {
            const book = HADITH_BOOKS.find((b) => b.key === r.book);
            const pct = book ? Math.min(100, (r.hadithNumber / book.total) * 100) : 0;
            return (
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

                <a
                  className="record-card-unit record-card-unit-clickable"
                  href={`https://sunnah.com/${r.book}:${r.hadithNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  title="عرض الحديث على sunnah.com"
                >
                  <div>{r.bookName} — الحديث رقم {r.hadithNumber}</div>
                  {book && (
                    <div className="record-card-unit-extra">
                      {r.hadithNumber} من {book.total} ({pct.toFixed(1)}٪)
                    </div>
                  )}
                </a>
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
            );
          })}
        </div>
      )}

      {reportRecord && (
        <HadithReportModal
          record={reportRecord}
          studentName={studentName(reportRecord.studentId)}
          onClose={() => setReportRecord(null)}
        />
      )}
    </div>
  );
}
