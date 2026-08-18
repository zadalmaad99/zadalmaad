import { useEffect, useState } from "react";
import { loadPageFont, loadPageWords } from "../utils/mushafText";

// Renders one mushaf page as real justified text in that page's own
// bespoke font, instead of a photograph — the only way a specific ayah can
// actually be highlighted rather than just named in a badge.
export default function MushafTextPage({ page, activeVerseKey, onReady }) {
  const [data, setData] = useState(null); // { lines, fontFamily } | null
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
      {data.lines.map((line, i) => (
        <div className="mushaf-text-line" key={i}>
          {line.map((w, j) => (
            <span
              key={j}
              className={w.verseKey === activeVerseKey ? "mushaf-word active" : "mushaf-word"}
            >
              {w.code}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}
