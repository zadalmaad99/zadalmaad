import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { toLoginEmail } from "../authIdentifier";
import logo from "../assets/logo.png";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(toLoginEmail(identifier), password);
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
        <h1>تسجيل دخول الأدمن</h1>
        <p className="subtitle">متابعة حفظ وقراءة القرآن الكريم</p>

        {error && <div className="error-box">{error}</div>}

        <label>
          البريد الإلكتروني أو رقم الهاتف
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            autoFocus
          />
        </label>

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
