import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  FLIP_MODES,
  FLIP_MODE_LABELS,
  FLIP_SPEED_MAX,
  FLIP_SPEED_MIN,
  getFlipMode,
  getFlipSpeed,
  playPageFlip,
  setFlipMode,
  setFlipSpeed,
} from "../utils/pageFlipSound";

// Owner-only tuning for how a mushaf page turns — kept out of everyone
// else's settings so the reader stays uncluttered. Each control previews
// itself immediately, so it can be judged by ear rather than by number.
export default function MushafFlipSettings() {
  const { isSupersuperadmin } = useAuth();
  const [mode, setMode] = useState(() => getFlipMode());
  const [speed, setSpeed] = useState(() => getFlipSpeed());

  if (!isSupersuperadmin) return null;

  function pickMode(m) {
    setMode(m);
    setFlipMode(m);
    playPageFlip(m);
  }

  function pickSpeed(v) {
    const n = Number(v);
    setSpeed(n);
    setFlipSpeed(n);
  }

  return (
    <div className="settings-card">
      <p className="settings-card-title">تقليب صفحات المصحف</p>

      <div className="flip-setting">
        <span className="flip-setting-label">صوت التقليب</span>
        <div className="flip-mode-row">
          {FLIP_MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={m === mode ? "flip-mode-btn active" : "flip-mode-btn"}
              onClick={() => pickMode(m)}
            >
              {FLIP_MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <p className="flip-setting-hint">اضغط على أي خيار لتسمعه مباشرة.</p>
      </div>

      <div className="flip-setting">
        <span className="flip-setting-label">
          سرعة التقليب: <strong>{speed} مللي ثانية</strong>
        </span>
        <input
          type="range"
          min={FLIP_SPEED_MIN}
          max={FLIP_SPEED_MAX}
          step={50}
          value={speed}
          onChange={(e) => pickSpeed(e.target.value)}
        />
        <div className="flip-scale">
          <span>أسرع</span>
          <span>أبطأ وأهدأ</span>
        </div>
        <button type="button" className="flip-preview-btn" onClick={() => playPageFlip(mode)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 21c-2.2-1.6-4.8-2.4-7.5-2.4V5.6C7.2 5.6 9.8 6.4 12 8c2.2-1.6 4.8-2.4 7.5-2.4v13c-2.7 0-5.3.8-7.5 2.4Z" />
            <path d="M12 8v13" />
          </svg>
          تجربة الصوت
        </button>
      </div>

      <p className="flip-setting-hint">
        يُطبَّق على قارئ المصحف بملء الشاشة في أقسام القراءة والحفظ والمراجعة.
      </p>
    </div>
  );
}
