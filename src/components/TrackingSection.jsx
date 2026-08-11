import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { SURAHS } from "../data/surahs";
import UnitPicker from "./UnitPicker";
import SurahProgressBar from "./SurahProgressBar";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

const EMPTY_FORM = {
  studentId: "",
  unitType: "surah",
  surahNumber: "",
  ayahFrom: 1,
  ayahTo: 1,
  juzNumber: "",
  hizbNumber: "",
  pageFrom: "",
  pageTo: "",
  date: new Date().toISOString().slice(0, 10),
  notes: "",
};

function unitLabel(r) {
  if (r.unitType === "juz") return `الجزء ${r.juzNumber}`;
  if (r.unitType === "hizb") return `الحزب ${r.hizbNumber}`;
  if (r.unitType === "page") return `صفحة ${r.pageFrom} - ${r.pageTo}`;
  return `${r.surahNumber}. ${r.surahName} (${r.ayahFrom} - ${r.ayahTo})`;
}

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
    if (!form.studentId) return;

    const payload = {
      type,
      studentId: form.studentId,
      unitType: form.unitType,
      date: form.date,
      notes: form.notes.trim(),
    };

    if (form.unitType === "surah") {
      if (!form.surahNumber) return;
      const surah = SURAHS.find((s) => s.number === Number(form.surahNumber));
      payload.surahNumber = Number(form.surahNumber);
      payload.surahName = surah?.name || "";
      payload.ayahFrom = Number(form.ayahFrom);
      payload.ayahTo = Number(form.ayahTo);
    } else if (form.unitType === "juz") {
      if (!form.juzNumber) return;
      payload.juzNumber = Number(form.juzNumber);
    } else if (form.unitType === "hizb") {
      if (!form.hizbNumber) return;
      payload.hizbNumber = Number(form.hizbNumber);
    } else if (form.unitType === "page") {
      if (!form.pageFrom || !form.pageTo) return;
      payload.pageFrom = Number(form.pageFrom);
      payload.pageTo = Number(form.pageTo);
    }

    if (editingId) {
      await api.updateRecord(editingId, payload);
    } else {
      await api.createRecord(payload);
    }
    resetForm();
  }

  function startEdit(r) {
    setEditingId(r.id);
    setForm({
      studentId: r.studentId,
      unitType: r.unitType || "surah",
      surahNumber: r.surahNumber || "",
      ayahFrom: r.ayahFrom || 1,
      ayahTo: r.ayahTo || 1,
      juzNumber: r.juzNumber || "",
      hizbNumber: r.hizbNumber || "",
      pageFrom: r.pageFrom || "",
      pageTo: r.pageTo || "",
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
      if (r.studentId === studentId && r.unitType !== "juz" && r.unitType !== "hizb" && r.unitType !== "page") {
        set.add(r.surahNumber);
      }
    }
    return set;
  }

  return (
    <div className="panel">
      <h3 className="panel-title">{title}</h3>

      {students.map((s) => (
        <div key={s.id} className="progress-block">
          <div className="progress-name">{s.name}</div>
          <SurahProgressBar coveredNumbers={coveredSurahsFor(s.id)} />
        </div>
      ))}

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

          <UnitPicker form={form} onChange={(vals) => setForm({ ...form, ...vals })} />

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
