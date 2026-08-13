import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import PhoneInput from "../components/PhoneInput";
import logo from "../assets/logo.png";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loginType, setLoginType] = useState("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const identifier =
        loginType === "phone"
          ? `${phone.replace(/[^\d]/g, "")}@phone.quran-tracker.app`
          : email.trim();
      await login(identifier, password);
      navigate("/");
    } catch {
      setError("فشل تسجيل الدخول: تحقق من البريد الإلكتروني/رقم الهاتف وكلمة المرور");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src={logo} alt="شعار التطبيق" className="login-logo" />
        <h1>زاد المعاد</h1>

        {error && <div className="error-box">{error}</div>}

        <div className="contact-toggle">
          <div className="contact-toggle-options">
            <label className="radio-label">
              <input
                type="radio"
                name="loginType"
                checked={loginType === "email"}
                onChange={() => setLoginType("email")}
              />
              بريد إلكتروني
            </label>
            <label className="radio-label">
              <input
                type="radio"
                name="loginType"
                checked={loginType === "phone"}
                onChange={() => setLoginType("phone")}
              />
              رقم هاتف
            </label>
          </div>
        </div>

        {loginType === "phone" ? (
          <label>
            رقم الهاتف
            <PhoneInput value={phone} onChange={setPhone} />
          </label>
        ) : (
          <label>
            البريد الإلكتروني
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
        )}

        <label>
          كلمة المرور
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? "جارٍ الدخول..." : "دخول"}
        </button>
      </form>
    </div>
  );
}
