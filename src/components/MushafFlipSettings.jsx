import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  FLIP_SPEED_MAX,
  FLIP_SPEED_MIN,
  getFlipMode,
  getFlipSpeed,
  getSoftness,
  playPageFlip,
  setFlipMode,
  setFlipSpeed,
  setSoftness,
} from "../utils/pageFlipSound";

// Owner-only tuning for how a mushaf page turns — kept out of everyone
// else's settings so the reader stays uncluttered. Each control previews
// itself immediately, so it can be judged by ear rather than by number.
export default function MushafFlipSettings() {
  const { isSupersuperadmin } = useAuth();
  const [mode, setMode] = useState(() => getFlipMode());
  const [speed, setSpeed] = useState(() => getFlipSpeed());
  const [soft, setSoft] = useState(() => getSoftness());

  if (!isSupersuperadmin) return null;

  function pickSpeed(v) {
    const n = Number(v);
    setSpeed(n);
    setFlipSpeed(n);
  }

  function pickSoft(v) {
    const n = Number(v);
    setSoft(n);
    setSoftness(n);
    playPageFlip(n, mode);
  }

  function toggleSound() {
    const next = mode === "off" ? "on" : "off";
    setMode(next);
    setFlipMode(next);
    if (next === "on") playPageFlip(soft, next);
  }

  return (
    <div className="settings-card">
      <p className="settings-card-title">تقليب صفحات المصحف</p>

      <div className="flip-setting">
        <span className="flip-setting-label">صوت التقليب</span>
        <div className="flip-mode-row">
          <button
            type="button"
            className={mode === "on" ? "flip-mode-btn active" : "flip-mode-btn"}
            onClick={toggleSound}
          >
            يعمل
          </button>
          <button
            type="button"
            className={mode === "off" ? "flip-mode-btn active" : "flip-mode-btn"}
            onClick={toggleSound}
          >
            صامت
          </button>
        </div>
      </div>

      <div className="flip-setting">
        <span className="flip-setting-label">
          درجة النعومة: <strong>{soft}%</strong>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={soft}
          disabled={mode === "off"}
          onChange={(e) => pickSoft(e.target.value)}
        />
        <div className="flip-scale">
          <span>واضح</span>
          <span>أنعم وأهدأ</span>
        </div>
        <p className="flip-setting-hint">
          حرّك الشريط لتسمع الفرق مباشرة — كلما زاد الرقم صار الصوت أخفت وأبطأ في الظهور.
        </p>
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
        <button type="button" className="flip-preview-btn" onClick={() => playPageFlip(soft, mode)}>
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
