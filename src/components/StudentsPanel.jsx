import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { api } from "../api";
import PhoneInput from "./PhoneInput";
import { COUNTRIES, splitPhone } from "../data/countries";
import { useCalendar } from "../context/CalendarContext";
import { useAuth } from "../context/AuthContext";
import AttendanceReportModal from "./AttendanceReportModal";
import ListeningReportModal from "./ListeningReportModal";

const EMPTY_FORM = {
  name: "",
  password: "",
  contactType: "email",
  contactValue: "",
};

function flagFor(phone) {
  const { dial } = splitPhone(phone);
  return COUNTRIES.find((c) => c.dial === dial)?.flag || "🌐";
}

function whatsappLink(phone) {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

const SECTIONS = [
  { key: "hifz", label: "حفظ", hasDomain: true },
  { key: "qiraah", label: "قراءة", hasDomain: true },
  { key: "murajaah", label: "مراجعة", hasDomain: true },
  { key: "attendance", label: "حضور", hasDomain: false },
];

export default function StudentsPanel({ onNavigate }) {
  const { formatDate } = useCalendar();
  const { user, isSuperadmin } = useAuth();
  const [students, setStudents] = useState([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingContactType, setEditingContactType] = useState("email");
  const [editingContactValue, setEditingContactValue] = useState("");
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");
  const [admins, setAdmins] = useState([]);
  const [teacherFilter, setTeacherFilter] = useState("");
  const [domainPicker, setDomainPicker] = useState(null);
  const [reportStudent, setReportStudent] = useState(null);
  const [listeningReportStudent, setListeningReportStudent] = useState(null);

  function toggleDomainPicker(studentId, sectionKey) {
    setDomainPicker((p) =>
      p && p.studentId === studentId && p.sectionKey === sectionKey
        ? null
        : { studentId, sectionKey }
    );
  }

  function pickDomain(sectionKey, studentId, domain) {
    setDomainPicker(null);
    onNavigate?.(sectionKey, studentId, domain);
  }

  useEffect(() => {
    const q = isSuperadmin
      ? query(collection(db, "students"), orderBy("name"))
      : query(
          collection(db, "students"),
          where("adminId", "==", user.uid),
          orderBy("name")
        );
    return onSnapshot(
      q,
      (snap) => {
        setLoadError("");
        setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => setLoadError(err.message || "تعذّر تحميل قائمة الطلاب")
    );
  }, [user, isSuperadmin]);

  useEffect(() => {
    if (!isSuperadmin) return;
    return onSnapshot(collection(db, "admins"), (snap) => {
      setAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [isSuperadmin]);

  const adminNameById = Object.fromEntries(admins.map((a) => [a.id, a.name]));

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
      setFormOpen(false);
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
    try {
      await api.deleteStudent(id);
    } catch (err) {
      alert(err.message || "تعذّر حذف الطالب");
    }
  }

  function startEdit(s) {
    setEditingId(s.id);
    setEditingName(s.name);
    setEditingContactType(s.contactType || "email");
    setEditingContactValue(s.contactValue || "");
  }

  async function saveEdit(id) {
    if (!editingName.trim()) return;
    try {
      await api.updateStudent(id, {
        name: editingName.trim(),
        contactType: editingContactType,
        contactValue: editingContactValue.trim(),
      });
      setEditingId(null);
    } catch (err) {
      alert(err.message || "تعذّر حفظ التعديل");
    }
  }

  return (
    <div className="panel">
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
          إضافة طالب
        </button>

        {formOpen && (
          <form className="record-form" onSubmit={handleAdd}>
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

            {error && <div className="error-box">{error}</div>}

            <div className="form-actions">
              <button type="submit" disabled={saving}>
                {saving ? "جارٍ الإضافة..." : "إضافة طالب وإنشاء حساب دخول"}
              </button>
            </div>
          </form>
        )}
      </div>

      {loadError && (
        <div className="error-box">
          تعذّر تحميل الطلاب: {loadError}
        </div>
      )}

      {students.length > 0 && (
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

      {isSuperadmin && admins.length > 0 && (
        <div className="teacher-filter">
          <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
            <option value="">كل المعلمين ({students.length} طالب)</option>
            {admins.map((a) => {
              const count = students.filter((s) => s.adminId === a.id).length;
              return (
                <option key={a.id} value={a.id}>
                  {a.name} ({count} طالب)
                </option>
              );
            })}
          </select>
        </div>
      )}

      {students
        .filter((s) => s.name?.toLowerCase().includes(search.trim().toLowerCase()))
        .filter((s) => !teacherFilter || s.adminId === teacherFilter).length === 0 ? (
        <p className="empty">لا يوجد طلاب</p>
      ) : (
        <div className="student-grid">
          {students
            .filter((s) => s.name?.toLowerCase().includes(search.trim().toLowerCase()))
            .filter((s) => !teacherFilter || s.adminId === teacherFilter)
            .map((s) => (
            <div key={s.id} className="student-card">
              {editingId === s.id ? (
                <div className="student-card-edit">
                  <input
                    className="student-card-name-input"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                  />
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
                  <div className="form-actions">
                    <button onClick={() => saveEdit(s.id)}>حفظ</button>
                    <button className="ghost" onClick={() => setEditingId(null)}>
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="student-card-header">
                    <div className="student-card-avatar">
                      {s.name?.trim()?.[0] || "?"}
                    </div>
                    <div className="student-card-body">
                      <div className="student-card-name">{s.name}</div>
                      {isSuperadmin && (
                        <div className="student-card-teacher">
                          المعلم: {adminNameById[s.adminId] || "—"}
                        </div>
                      )}
                      <div className="student-card-date">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="18" rx="2" />
                          <path d="M16 2v4M8 2v4M3 10h18" />
                        </svg>
                        {formatDate(s.createdAt)}
                      </div>
                    </div>
                  </div>

                  <div className="student-card-contact">
                    {s.contactType === "phone" ? (
                      <a
                        className="whatsapp-link"
                        href={whatsappLink(s.contactValue)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {flagFor(s.contactValue)} +{s.contactValue}
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.8.9-.2.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5.1-.1.2-.3.4-.4.1-.1.2-.2.2-.4.1-.2 0-.3 0-.4 0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.2 1.6 2.5 3.9 3.4.5.2 1 .4 1.3.5.5.2 1 .1 1.3.1.4-.1 1.2-.5 1.4-1 .2-.5.2-.9.1-1Z" />
                        </svg>
                      </a>
                    ) : (
                      <span>{s.contactValue || "—"}</span>
                    )}
                  </div>

                  <div className="student-card-sections">
                    {SECTIONS.map((sec) => (
                      <button
                        key={sec.key}
                        type="button"
                        className="section-pill"
                        onClick={() =>
                          sec.hasDomain
                            ? toggleDomainPicker(s.id, sec.key)
                            : onNavigate?.(sec.key, s.id)
                        }
                      >
                        {sec.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="section-pill attendance-report-btn"
                    onClick={() => setReportStudent(s)}
                  >
                    تقرير الحضور
                  </button>
                  <button
                    type="button"
                    className="section-pill attendance-report-btn"
                    onClick={() => setListeningReportStudent(s)}
                  >
                    تقرير الاستماع للمنهج
                  </button>

                  {domainPicker?.studentId === s.id && (
                    <div className="domain-picker">
                      <button
                        type="button"
                        className="domain-pill"
                        onClick={() => pickDomain(domainPicker.sectionKey, s.id, "quran")}
                      >
                        القرآن
                      </button>
                      <button
                        type="button"
                        className="domain-pill"
                        onClick={() => pickDomain(domainPicker.sectionKey, s.id, "hadith")}
                      >
                        الكتب الستة
                      </button>
                    </div>
                  )}

                  <div className="student-card-actions">
                    <button className="ghost" onClick={() => startEdit(s)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                      </svg>
                      تعديل
                    </button>
                    <button className="danger" onClick={() => handleDelete(s.id)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
                      </svg>
                      حذف
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {reportStudent && (
        <AttendanceReportModal
          studentId={reportStudent.id}
          studentName={reportStudent.name}
          onClose={() => setReportStudent(null)}
          onViewDetails={() => {
            const id = reportStudent.id;
            setReportStudent(null);
            onNavigate?.("attendance", id);
          }}
        />
      )}

      {listeningReportStudent && (
        <ListeningReportModal
          studentId={listeningReportStudent.id}
          studentName={listeningReportStudent.name}
          onClose={() => setListeningReportStudent(null)}
        />
      )}
    </div>
  );
}
