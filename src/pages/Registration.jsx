import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { api } from "../api";
import PhoneInput from "../components/PhoneInput";
import logo from "../assets/logo.png";

const PHONE_DOMAIN = "phone.quran-tracker.app";

export default function Registration() {
  const navigate = useNavigate();
  const [contactType, setContactType] = useState("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("أدخل الاسم");
      return;
    }
    setLoading(true);

    const contactValue = contactType === "phone" ? phone : email.trim();
    const loginEmail =
      contactType === "phone"
        ? `${phone.replace(/[^\d]/g, "")}@${PHONE_DOMAIN}`
        : contactValue;

    try {
      await createUserWithEmailAndPassword(auth, loginEmail, password);
      await api.registerAdmin({
        name: name.trim(),
        contactType,
        contactValue,
      });
      navigate("/");
    } catch (err) {
      if (err.code === "auth/email-already-in-use") {
        setError("هذا البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل");
      } else if (err.code === "auth/weak-password") {
        setError("كلمة المرور ضعيفة، يجب أن تكون 6 أحرف على الأقل");
      } else {
        setError("تعذّر إنشاء الحساب، حاول مرة أخرى");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src={logo} alt="شعار التطبيق" className="login-logo" />
        <h1>زاد المعاد</h1>
        <p className="subtitle">إنشاء حساب معلّم جديد</p>

        {error && <div className="error-box">{error}</div>}

        <label>
          الاسم
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </label>

        <div className="contact-toggle">
          <span className="contact-toggle-label">التسجيل عن طريق</span>
          <div className="contact-toggle-options">
            <label className="radio-label">
              <input
                type="radio"
                name="contactType"
                checked={contactType === "email"}
                onChange={() => setContactType("email")}
              />
              بريد إلكتروني
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="contactType"
                checked={contactType === "phone"}
                onChange={() => setContactType("phone")}
              />
              رقم هاتف
            </label>
          </div>
        </div>

        {contactType === "phone" ? (
          <label>
            رقم الهاتف
            <PhoneInput value={phone} onChange={setPhone} />
          </label>
        ) : (
          <label>
            البريد الإلكتروني
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
        )}

        <label>
          كلمة المرور
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "جارٍ الإنشاء..." : "إنشاء حساب معلّم"}
        </button>

        <Link to="/login" className="register-link">
          لديك حساب بالفعل؟ تسجيل الدخول
        </Link>
      </form>
    </div>
  );
}
