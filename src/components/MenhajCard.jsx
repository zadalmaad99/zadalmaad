export default function MenhajCard({ icon, title, subtitle, stats, active, onClick }) {
  return (
    <button
      type="button"
      className={active ? "menhaj-card active" : "menhaj-card"}
      onClick={onClick}
      aria-expanded={active}
    >
      <span className="menhaj-card-top">
        <span className="menhaj-card-icon">{icon}</span>
        <span className="menhaj-card-heading">
          <span className="menhaj-card-title">{title}</span>
          <span className="menhaj-card-subtitle">{subtitle}</span>
        </span>
        <span className="menhaj-card-chevron" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </span>

      <span className="menhaj-card-stats">
        {stats.map((s) => (
          <span key={s.label} className="menhaj-card-stat">
            <span className="menhaj-card-stat-value">{s.value}</span>
            <span className="menhaj-card-stat-label">{s.label}</span>
          </span>
        ))}
      </span>

      <span className="menhaj-card-cta">{active ? "اضغط للإغلاق" : "اضغط للعرض"}</span>
    </button>
  );
}
