import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isFlipMuted, playPageFlip, setFlipMuted } from "../utils/pageFlipSound";

const PAGE_COUNT = 604;
const MIN_SCALE = 1;
const MAX_SCALE = 4;

function pageUrl(page) {
  const padded = String(page).padStart(3, "0");
  return `https://files.quran.app/hafs/madani/width_1260/page${padded}.png`;
}

// The page image + prev/next controls, reused both inside the popup modal
// (from student tracking records) and embedded directly on the page (public
// Quran reader) — same viewer, different wrapper.
export function QuranPageViewer({ page, onPageChange }) {
  const [loading, setLoading] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  function go(delta) {
    const next = Math.min(PAGE_COUNT, Math.max(1, page + delta));
    if (next === page) return;
    playPageFlip();
    setLoading(true);
    onPageChange(next);
  }

  return (
    <>
      <div className="quran-page-viewer">
        {loading && <div className="quran-page-loading">جارٍ التحميل...</div>}
        <img
          src={pageUrl(page)}
          alt={`صفحة ${page}`}
          className="quran-page-img"
          onLoad={() => setLoading(false)}
          style={{ display: loading ? "none" : "block" }}
        />
        <button
          type="button"
          className="quran-page-expand"
          onClick={() => setFullscreen(true)}
          aria-label="تكبير الصفحة لملء الشاشة"
          title="ملء الشاشة"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m0 8v3a2 2 0 0 0 2 2h3m8-18h3a2 2 0 0 1 2 2v3m0 8v3a2 2 0 0 1-2 2h-3" />
          </svg>
        </button>
      </div>

      <div className="quran-page-nav">
        <button type="button" className="ghost" onClick={() => go(-1)} disabled={page <= 1}>
          الصفحة السابقة
        </button>
        <span className="hint-text">{page} / {PAGE_COUNT}</span>
        <button type="button" className="ghost" onClick={() => go(1)} disabled={page >= PAGE_COUNT}>
          الصفحة التالية
        </button>
      </div>

      {fullscreen && (
        <QuranFullscreenReader page={page} onPageChange={onPageChange} onClose={() => setFullscreen(false)} />
      )}
    </>
  );
}

// Full-screen mushaf: side arrows pinned to the middle edges for one-thumb
// paging, +/− buttons, and real pinch-to-zoom with drag-to-pan once zoomed
// (panning is disabled at 1x so a plain swipe still can't strand the page
// off-centre).
function QuranFullscreenReader({ page, onPageChange, onClose }) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [muted, setMuted] = useState(() => isFlipMuted());
  const pinchRef = useRef(null);
  const panRef = useRef(null);
  const swipeRef = useRef(null);

  function go(delta) {
    const next = Math.min(PAGE_COUNT, Math.max(1, page + delta));
    if (next === page) return;
    playPageFlip();
    setLoading(true);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    onPageChange(next);
  }

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
      // Matches the swipe: rightward moves forward through the mushaf.
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    }
    window.addEventListener("keydown", onKey);
    // The body must not scroll behind a full-screen reader.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  });

  function dist(t) {
    return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  }

  function handleTouchStart(e) {
    if (e.touches.length === 2) {
      pinchRef.current = { startDist: dist(e.touches), startScale: scale };
      panRef.current = null;
      swipeRef.current = null;
    } else if (e.touches.length === 1 && scale > 1) {
      panRef.current = {
        x: e.touches[0].clientX - offset.x,
        y: e.touches[0].clientY - offset.y,
      };
    } else if (e.touches.length === 1) {
      // Only at 1x — once zoomed in, a one-finger drag means pan, not turn.
      swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  }

  function handleTouchMove(e) {
    if (pinchRef.current && e.touches.length === 2) {
      e.preventDefault();
      const next = (dist(e.touches) / pinchRef.current.startDist) * pinchRef.current.startScale;
      setScale(Math.min(MAX_SCALE, Math.max(MIN_SCALE, next)));
    } else if (panRef.current && e.touches.length === 1) {
      e.preventDefault();
      setOffset({
        x: e.touches[0].clientX - panRef.current.x,
        y: e.touches[0].clientY - panRef.current.y,
      });
    }
  }

  function handleTouchEnd(e) {
    // A mostly-horizontal flick at 1x turns the page. The mushaf is bound
    // on the right — الفاتحة is the rightmost page and السور تتقدم يسارًا —
    // so moving forward means sweeping the sheet rightward, exactly like
    // turning a page in the physical book.
    const s = swipeRef.current;
    if (s && scale <= 1) {
      const t = e.changedTouches?.[0];
      if (t) {
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx > 0 ? 1 : -1);
      }
    }
    pinchRef.current = null;
    panRef.current = null;
    swipeRef.current = null;
    if (scale <= 1) setOffset({ x: 0, y: 0 });
  }

  function zoom(delta) {
    setScale((s) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + delta));
      if (next <= 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }

  return createPortal(
    <div className="quran-fs">
      <div className="quran-fs-bar">
        <span className="quran-fs-page">صفحة {page} من {PAGE_COUNT}</span>
        <div className="quran-fs-zoom">
          <button type="button" onClick={() => zoom(-0.25)} disabled={scale <= MIN_SCALE} aria-label="تصغير">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14" />
            </svg>
          </button>
          <span>{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => zoom(0.25)} disabled={scale >= MAX_SCALE} aria-label="تكبير">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          className="quran-fs-close"
          onClick={() => {
            setFlipMuted(!muted);
            setMuted(!muted);
          }}
          aria-label={muted ? "تشغيل صوت تقليب الصفحات" : "كتم صوت تقليب الصفحات"}
          title={muted ? "تشغيل الصوت" : "كتم الصوت"}
        >
          {muted ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5 6 9H3v6h3l5 4V5Z" />
              <path d="m22 9-6 6m0-6 6 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5 6 9H3v6h3l5 4V5Z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
          )}
        </button>
        <button type="button" className="quran-fs-close" onClick={onClose} aria-label="إغلاق">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div
        className="quran-fs-stage"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {loading && <div className="quran-page-loading">جارٍ التحميل...</div>}
        <img
          src={pageUrl(page)}
          alt={`صفحة ${page}`}
          className="quran-fs-img"
          onLoad={() => setLoading(false)}
          style={{
            display: loading ? "none" : "block",
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        />
      </div>

      {/* No arrow buttons — they sat on top of the text. Paging is by
          swipe (and by keyboard on desktop). */}
      <p className="quran-fs-hint">اسحب يمينًا للصفحة التالية، ويسارًا للسابقة</p>
    </div>,
    document.body
  );
}

export default function QuranPageModal({ page, onClose }) {
  const [current, setCurrent] = useState(page);

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

        <QuranPageViewer page={current} onPageChange={setCurrent} />
      </div>
    </div>
  );
}
