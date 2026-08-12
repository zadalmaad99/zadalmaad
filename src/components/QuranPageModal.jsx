import { useState } from "react";

const PAGE_COUNT = 604;

function pageUrl(page) {
  const padded = String(page).padStart(3, "0");
  return `https://files.quran.app/hafs/madani/width_1260/page${padded}.png`;
}

export default function QuranPageModal({ page, onClose }) {
  const [current, setCurrent] = useState(page);
  const [loading, setLoading] = useState(true);

  function go(delta) {
    const next = Math.min(PAGE_COUNT, Math.max(1, current + delta));
    if (next === current) return;
    setLoading(true);
    setCurrent(next);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-card quran-page-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>صفحة {current} من المصحف</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="quran-page-viewer">
          {loading && <div className="quran-page-loading">جارٍ التحميل...</div>}
          <img
            src={pageUrl(current)}
            alt={`صفحة ${current}`}
            className="quran-page-img"
            onLoad={() => setLoading(false)}
            style={{ display: loading ? "none" : "block" }}
          />
        </div>

        <div className="quran-page-nav">
          <button
            type="button"
            className="ghost"
            onClick={() => go(1)}
            disabled={current >= PAGE_COUNT}
          >
            الصفحة التالية
          </button>
          <span className="hint-text">{current} / {PAGE_COUNT}</span>
          <button
            type="button"
            className="ghost"
            onClick={() => go(-1)}
            disabled={current <= 1}
          >
            الصفحة السابقة
          </button>
        </div>
      </div>
    </div>
  );
}
