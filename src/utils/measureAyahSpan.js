import { loadPageFont, loadPageWords } from "./mushafText";

// Where an ayah's words actually sit within their printed line(s) — not
// just which line, but the horizontal span, so the ruler can be as short
// as the ayah itself instead of running the full line width. There is no
// published per-word coordinate data for the raster page images, so this
// renders the same words in that page's own font (off-screen, at the
// container's real width) and measures the glyphs directly — the font is
// the authentic source for how wide each word is on this exact page.
let measureEl = null;
function getMeasureEl() {
  if (!measureEl) {
    measureEl = document.createElement("div");
    Object.assign(measureEl.style, {
      position: "fixed",
      top: "-9999px",
      left: "0",
      visibility: "hidden",
      whiteSpace: "nowrap",
      lineHeight: "1",
    });
    measureEl.dir = "rtl";
    document.body.appendChild(measureEl);
  }
  return measureEl;
}

const BASE_FONT_PX = 28;

// Renders one line's words at a fixed font-size (nowrap — CSS justify needs
// actual wrapping to stretch anything, and with a single line to measure
// it never gets that, which was overflowing the container silently) and
// returns each word's [left, right] in that natural, unscaled layout, plus
// the line's own total width.
function layoutLine(el, fontFamily, lineWords) {
  el.style.fontFamily = fontFamily;
  el.style.fontSize = `${BASE_FONT_PX}px`;
  el.style.width = "max-content";
  el.innerHTML = "";
  const spans = lineWords.map((w) => {
    const s = document.createElement("span");
    s.textContent = w.code;
    el.appendChild(s);
    return s;
  });
  const containerLeft = el.getBoundingClientRect().left;
  const rects = spans.map((s) => {
    const r = s.getBoundingClientRect();
    return { left: r.left - containerLeft, right: r.right - containerLeft };
  });
  const totalWidth = Math.max(...rects.map((r) => r.right));
  return { rects, totalWidth };
}

// Returns [{ line, left, right }] as fractions (0..1) of containerWidthPx,
// one entry per line the ayah's words touch. The per-page font is
// pre-kerned to exactly fill its real printed line at its own size, which
// this can't reproduce — so each line is instead measured at a fixed size
// and uniformly scaled to fill containerWidthPx, the same effect (exact
// fill) reached a different way.
export async function measureAyahSpans(page, verseKey, containerWidthPx) {
  const [{ lines }, fontFamily] = await Promise.all([loadPageWords(page), loadPageFont(page)]);
  const el = getMeasureEl();

  const results = [];
  for (const lineWords of lines) {
    if (!lineWords.some((w) => w.verseKey === verseKey)) continue;
    const { rects, totalWidth } = layoutLine(el, fontFamily, lineWords);
    if (!totalWidth) continue;
    const scale = containerWidthPx / totalWidth;

    let left = Infinity;
    let right = -Infinity;
    lineWords.forEach((w, i) => {
      if (w.verseKey !== verseKey) return;
      left = Math.min(left, rects[i].left);
      right = Math.max(right, rects[i].right);
    });
    if (right > left) {
      results.push({
        line: lineWords[0].line,
        left: (left * scale) / containerWidthPx,
        right: (right * scale) / containerWidthPx,
      });
    }
  }
  return results;
}
