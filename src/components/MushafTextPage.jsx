import { useEffect, useState } from "react";
import { loadPageFont, loadPageWords } from "../utils/mushafText";
import { SURAHS } from "../data/surahs";

const BASMALAH = "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ";

// Renders one mushaf page as real justified text in that page's own
// bespoke font, instead of a photograph — the only way a specific ayah can
// actually be highlighted rather than just named in a badge. The ornamental
// سورة banner and the بسملة are page furniture the word API doesn't carry,
// so they're reconstructed here to match the printed mushaf's layout.
export default function MushafTextPage({ page, activeVerseKey, onReady }) {
  const [data, setData] = useState(null); // { lines, surahStarts, fontFamily } | null
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    Promise.all([loadPageWords(page), loadPageFont(page)])
      .then(([words, fontFamily]) => {
        if (cancelled) return;
        setData({ ...words, fontFamily });
        onReady?.();
      })
      .catch(() => {
        if (!cancelled) setError("تعذّر تحميل نص هذه الصفحة");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  if (error) return <div className="mushaf-text-error">{error}</div>;
  if (!data) return null;

  return (
    <div className="mushaf-text-page" style={{ fontFamily: data.fontFamily }} dir="rtl">
      {data.lines.map((line, i) => {
        const lineNumber = line[0]?.line;
        const starts = (data.surahStarts || []).filter((s) => s.beforeLine === lineNumber);
        return (
          <div key={i}>
            {starts.map((s) => (
              <div key={s.surah} className="mushaf-surah-open">
                <div className="mushaf-surah-banner">
                  <span className="mushaf-banner-rosette" aria-hidden="true">
                    <svg viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="17" className="mushaf-rose-ring" />
                      <circle cx="20" cy="20" r="11" className="mushaf-rose-ring" />
                      <g className="mushaf-rose-petals">
                        {Array.from({ length: 8 }).map((_, k) => (
                          <ellipse key={k} cx="20" cy="7.5" rx="2.6" ry="5" transform={`rotate(${k * 45} 20 20)`} />
                        ))}
                      </g>
                      <circle cx="20" cy="20" r="3.2" className="mushaf-rose-core" />
                    </svg>
                  </span>
                  <span className="mushaf-banner-name">
                    سورة {SURAHS.find((x) => x.number === s.surah)?.name}
                  </span>
                  <span className="mushaf-banner-rosette" aria-hidden="true">
                    <svg viewBox="0 0 40 40">
                      <circle cx="20" cy="20" r="17" className="mushaf-rose-ring" />
                      <circle cx="20" cy="20" r="11" className="mushaf-rose-ring" />
                      <g className="mushaf-rose-petals">
                        {Array.from({ length: 8 }).map((_, k) => (
                          <ellipse key={k} cx="20" cy="7.5" rx="2.6" ry="5" transform={`rotate(${k * 45} 20 20)`} />
                        ))}
                      </g>
                      <circle cx="20" cy="20" r="3.2" className="mushaf-rose-core" />
                    </svg>
                  </span>
                </div>
                {/* الفاتحة's بسملة is itself its counted first ayah (rendered
                    below via the real word glyphs) and التوبة has none at
                    all — both would otherwise show it twice. */}
                {s.surah !== 1 && s.surah !== 9 && <div className="mushaf-basmalah">{BASMALAH}</div>}
              </div>
            ))}
            <div className="mushaf-text-line">
              {line.map((w, j) => (
                <span
                  key={j}
                  className={w.verseKey === activeVerseKey ? "mushaf-word active" : "mushaf-word"}
                >
                  {w.code}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
