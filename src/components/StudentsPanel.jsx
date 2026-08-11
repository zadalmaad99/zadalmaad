import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { api } from "../api";

const EMPTY_FORM = { name: "", email: "", password: "" };

export default function StudentsPanel() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("name"));
    return onSnapshot(q, (snap) => {
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) return;
    setError("");
    setSaving(true);
    try {
      await api.createStudent(form.name.trim(), form.email.trim(), form.password);
      setForm(EMPTY_FORM);
    } catch (err) {
      if (err.message === "email already in use") {
        setError("هذا البريد الإلكتروني مستخدم بالفعل");
      } else if (err.message.includes("password")) {
        setError("كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل");
      } else if (err.message.includes("email")) {
        setError("صيغة البريد الإلكتروني غير صحيحة");
      } else {
        setError("حدث خطأ أثناء إنشاء حساب الطالب");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (
      !confirm(
        "هل أنت متأكد من حذف هذا الطالب؟ سيتم الاحتفاظ بسجلاته، وسيُسحب حق دخوله فورًا، لكن حسابه في Firebase Authentication يبقى موجودًا (يمكن حذفه يدويًا من Firebase Console إذا أردت)."
      )
    )
      return;
    await api.deleteStudent(id);
  }

  function startEdit(s) {
    setEditingId(s.id);
    setEditingName(s.name);
  }

  async function saveEdit(id) {
    if (!editingName.trim()) return;
    await api.updateStudent(id, editingName.trim());
    setEditingId(null);
  }

  return (
    <div className="panel">
      <form className="record-form" onSubmit={handleAdd}>
        <div className="picker-row">
          <label>
            اسم الطالب
            <input
              type="text"
              placeholder="اسم الطالب"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>
          <label>
            البريد الإلكتروني (لتسجيل دخول الطالب)
            <input
              type="email"
              placeholder="student@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </label>
          <label>
            كلمة المرور
            <input
              type="password"
              placeholder="6 أحرف على الأقل"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              minLength={6}
              required
            />
          </label>
        </div>

        {error && <div className="error-box">{error}</div>}

        <div className="form-actions">
          <button type="submit" disabled={saving}>
            {saving ? "جارٍ الإضافة..." : "إضافة طالب وإنشاء حساب دخول"}
          </button>
        </div>
      </form>

      <table>
        <thead>
          <tr>
            <th>الاسم</th>
            <th>البريد الإلكتروني</th>
            <th>إجراءات</th>
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td>
                {editingId === s.id ? (
                  <input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
                ) : (
                  s.name
                )}
              </td>
              <td>{s.email || "—"}</td>
              <td className="actions">
                {editingId === s.id ? (
                  <>
                    <button onClick={() => saveEdit(s.id)}>حفظ</button>
                    <button className="ghost" onClick={() => setEditingId(null)}>
                      إلغاء
                    </button>
                  </>
                ) : (
                  <>
                    <button className="ghost" onClick={() => startEdit(s)}>
                      تعديل
                    </button>
                    <button className="danger" onClick={() => handleDelete(s.id)}>
                      حذف
                    </button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {students.length === 0 && (
            <tr>
              <td colSpan={3} className="empty">
                لا يوجد طلاب بعد
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
