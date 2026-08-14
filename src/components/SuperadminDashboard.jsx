import { useEffect, useState } from "react";
import { useCalendar } from "../context/CalendarContext";
import { api } from "../api";
import { COUNTRIES, splitPhone } from "../data/countries";

function flagFor(phone) {
  const { dial } = splitPhone(phone);
  return COUNTRIES.find((c) => c.dial === dial)?.flag || "🌐";
}

export default function SuperadminDashboard({ onViewAdmin }) {
  const { formatDate } = useCalendar();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .listAdmins()
      .then((data) => setAdmins(data.admins || []))
      .catch((err) => setError(err.message || "تعذّر تحميل بيانات المعلمين"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="panel">
      <h3 className="panel-title">إجمالي المعلمين المسجّلين: {admins.length}</h3>

      {loading && <p className="empty">جارٍ التحميل...</p>}
      {error && <div className="error-box">{error}</div>}

      {!loading && !error && admins.length === 0 && (
        <p className="empty">لا يوجد معلمون مسجّلون بعد</p>
      )}

      {!loading && admins.length > 0 && (
        <ol className="overview-list">
          {admins.map((a, i) => (
            <li key={a.id} className="overview-card">
              <div className="overview-card-head">
                <span className="overview-rank">#{i + 1}</span>
                <div className="overview-card-title">
                  <span className="overview-name">{a.name}</span>
                  <div className="overview-meta">
                    <span className="overview-meta-item">
                      تاريخ التسجيل: {formatDate(a.createdAt)}
                    </span>
                    <span className="overview-meta-item">
                      {a.contactType === "phone"
                        ? `${flagFor(a.contactValue)} +${a.contactValue}`
                        : `✉️ ${a.contactValue}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="superadmin-stats">
                <div className="superadmin-stat">
                  <span className="superadmin-stat-value">{a.studentCount}</span>
                  <span className="superadmin-stat-label">طالب</span>
                </div>
                <div className="superadmin-stat">
                  <span className="superadmin-stat-value">{a.activityCount}</span>
                  <span className="superadmin-stat-label">سجل مضاف (نشاط)</span>
                </div>
              </div>

              <button
                type="button"
                className="attendance-report-btn overview-attendance-report-btn"
                onClick={() => onViewAdmin?.(a.id, a.name)}
              >
                عرض لوحة المعلم بالكامل
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
