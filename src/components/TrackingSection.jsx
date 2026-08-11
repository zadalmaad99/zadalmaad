import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";
import { SURAHS } from "../data/surahs";
import SurahAyahPicker from "./SurahAyahPicker";
import { useAuth } from "../context/AuthContext";

const EMPTY_FORM = {
  studentId: "",
  surahNumber: "",
  ayahFrom: 1,
  ayahTo: 1,
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

export default function TrackingSection({ type, title }) {
  const { isAdmin } = useAuth();
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);

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
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.studentId || !form.surahNumber) return;

    const surah = SURAHS.find((s) => s.number === Number(form.surahNumber));
    const payload = {
      type,
      studentId: form.studentId,
      surahNumber: Number(form.surahNumber),
      surahName: surah?.name || "",
      ayahFrom: Number(form.ayahFrom),
      ayahTo: Number(form.ayahTo),
      date: form.date,
      notes: form.notes.trim(),
      updatedAt: Date.now(),
    };

    if (editingId) {
      await updateDoc(doc(db, "records", editingId), payload);
    } else {
      await addDoc(collection(db, "records"), {
        ...payload,
        createdAt: Date.now(),
      });
    }
    resetForm();
  }

  function startEdit(r) {
    setEditingId(r.id);
    setForm({
      studentId: r.studentId,
      surahNumber: r.surahNumber,
      ayahFrom: r.ayahFrom,
      ayahTo: r.ayahTo,
      date: r.date,
      notes: r.notes || "",
    });
  }

  async function handleDelete(id) {
    if (!confirm("هل أنت متأكد من حذف هذا السجل؟")) return;
    await deleteDoc(doc(db, "records", id));
  }

  function studentName(id) {
    return students.find((s) => s.id === id)?.name || "—";
  }

  return (
    <div className="panel">
      <h3 className="panel-title">{title}</h3>

      {isAdmin && (
        <form className="record-form" onSubmit={handleSubmit}>
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
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                required
              />
            </label>
          </div>

          <SurahAyahPicker
            surahNumber={form.surahNumber}
            ayahFrom={form.ayahFrom}
            ayahTo={form.ayahTo}
            onChange={(vals) => setForm({ ...form, ...vals })}
          />

          <label>
            ملاحظات
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </label>

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

      <table>
        <thead>
          <tr>
            <th>الطالب</th>
            <th>السورة</th>
            <th>من - إلى</th>
            <th>التاريخ</th>
            <th>ملاحظات</th>
            {isAdmin && <th>إجراءات</th>}
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td>{studentName(r.studentId)}</td>
              <td>
                {r.surahNumber}. {r.surahName}
              </td>
              <td>
                {r.ayahFrom} - {r.ayahTo}
              </td>
              <td>{r.date}</td>
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
              <td colSpan={isAdmin ? 6 : 5} className="empty">
                لا توجد سجلات بعد
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
