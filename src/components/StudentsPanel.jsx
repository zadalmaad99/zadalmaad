import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { api } from "../api";
import PhoneInput from "./PhoneInput";

const EMPTY_FORM = {
  name: "",
  password: "",
  contactType: "email",
  contactValue: "",
};

function whatsappLink(phone) {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

export default function StudentsPanel() {
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingContactType, setEditingContactType] = useState("email");
  const [editingContactValue, setEditingContactValue] = useState("");

  useEffect(() => {
    const q = query(collection(db, "students"), orderBy("name"));
    return onSnapshot(q, (snap) => {
      setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.contactValue.trim() || !form.password) return;
    setError("");
    setSaving(true);
    try {
      await api.createStudent({
        name: form.name.trim(),
        password: form.password,
        contactType: form.contactType,
        contactValue: form.contactValue.trim(),
      });
      setForm(EMPTY_FORM);
    } catch (err) {
      if (err.message === "email already in use") {
        setError("هذا البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل");
      } else if (err.message.includes("password")) {
        setError("كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل");
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
    setEditingContactType(s.contactType || "email");
    setEditingContactValue(s.contactValue || "");
  }

  async function saveEdit(id) {
    if (!editingName.trim()) return;
    await api.updateStudent(id, {
      name: editingName.trim(),
      contactType: editingContactType,
      contactValue: editingContactValue.trim(),
    });
    setEditingId(null);
  }

  return (
    <div className="panel">
      <form className="record-form" onSubmit={handleAdd}>
        <div className="picker-row">
          <div className="contact-toggle">
            <span className="contact-toggle-label">
              تسجيل الدخول والتواصل عن طريق
            </span>
            <div className="contact-toggle-options">
              <label className="radio-label">
                <input
                  type="radio"
                  name="contactType"
                  checked={form.contactType === "email"}
                  onChange={() =>
                    setForm({ ...form, contactType: "email", contactValue: "" })
                  }
                />
                بريد إلكتروني
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="contactType"
                  checked={form.contactType === "phone"}
                  onChange={() =>
                    setForm({ ...form, contactType: "phone", contactValue: "" })
                  }
                />
                رقم هاتف (واتساب)
              </label>
            </div>
          </div>

          {form.contactType === "phone" ? (
            <label>
              رقم الهاتف
              <PhoneInput
                value={form.contactValue}
                onChange={(v) => setForm({ ...form, contactValue: v })}
              />
            </label>
          ) : (
            <label>
              البريد الإلكتروني
              <input
                type="email"
                placeholder="student@example.com"
                value={form.contactValue}
                onChange={(e) => setForm({ ...form, contactValue: e.target.value })}
                required
              />
            </label>
          )}
        </div>

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
            <th>بريد/هاتف الدخول</th>
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
              <td>
                {editingId === s.id ? (
                  <div className="contact-toggle">
                    <span className="hint-text">
                      تعديل هنا للعرض فقط، بيانات الدخول الفعلية لا تتغير
                    </span>
                    <div className="contact-toggle-options">
                      <label className="radio-label">
                        <input
                          type="radio"
                          name={`editContactType-${s.id}`}
                          checked={editingContactType === "email"}
                          onChange={() => setEditingContactType("email")}
                        />
                        بريد
                      </label>
                      <label className="radio-label">
                        <input
                          type="radio"
                          name={`editContactType-${s.id}`}
                          checked={editingContactType === "phone"}
                          onChange={() => setEditingContactType("phone")}
                        />
                        هاتف
                      </label>
                    </div>
                    {editingContactType === "phone" ? (
                      <PhoneInput
                        value={editingContactValue}
                        onChange={setEditingContactValue}
                      />
                    ) : (
                      <input
                        type="email"
                        value={editingContactValue}
                        onChange={(e) => setEditingContactValue(e.target.value)}
                      />
                    )}
                  </div>
                ) : s.contactType === "phone" ? (
                  <a
                    className="whatsapp-link"
                    href={whatsappLink(s.contactValue)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    +{s.contactValue}
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.8.9-.2.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5.1-.1.2-.3.4-.4.1-.1.2-.2.2-.4.1-.2 0-.3 0-.4 0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.2 1.6 2.5 3.9 3.4.5.2 1 .4 1.3.5.5.2 1 .1 1.3.1.4-.1 1.2-.5 1.4-1 .2-.5.2-.9.1-1Z" />
                    </svg>
                  </a>
                ) : (
                  s.contactValue || "—"
                )}
              </td>
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
