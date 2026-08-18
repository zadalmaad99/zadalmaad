// Real per-word mushaf text, replacing the photographed page image so an
// ayah can actually be highlighted while it's recited. Each of the 604
// pages has its own bespoke font (QCF v2) where every glyph's shape and
// spacing was hand-kerned to justify exactly that page's lines — the
// standard technique every text-based mushaf app uses, not a rendering
// trick of ours. Word text/line data and the fonts come from two separate
// public, CORS-open sources and are fetched once per page and cached.
const FONT_BASE = "https://cdn.jsdelivr.net/gh/nuqayah/qpc-fonts@master/mushaf-v2";

const wordsCache = new Map();
const fontCache = new Map(); // page -> font-family name (Promise)

function fontFamilyFor(page) {
  return `qcf-page-${page}`;
}

export async function loadPageWords(page) {
  if (wordsCache.has(page)) return wordsCache.get(page);
  const promise = (async () => {
    // code_v2 is the codepoint scheme that matches the QCF *v2* font files
    // below — code_v1 belongs to the older QCF v1 fonts and renders as
    // garbled shapes when paired with a v2 font, which is exactly the bug
    // this was shipped with the first time.
    const res = await fetch(
      `https://api.qurancdn.com/api/qdc/verses/by_page/${page}?words=true&word_fields=code_v2,line_number,verse_key&fields=verse_number&mushaf=2&per_page=100`
    );
    if (!res.ok) throw new Error("تعذّر جلب نص الصفحة");
    const json = await res.json();
    const words = json.verses.flatMap((v) =>
      v.words.map((w) => ({
        code: w.code_v2,
        line: w.line_number,
        verseKey: w.verse_key,
        type: w.char_type_name,
      }))
    );
    const lineNumbers = [...new Set(words.map((w) => w.line))].sort((a, b) => a - b);
    const lines = lineNumbers.map((n) => words.filter((w) => w.line === n));

    // The API only returns ayah words — the ornamental سورة banner and the
    // unnumbered opening بسملة are page furniture it doesn't carry, so a
    // surah's first line on this page is detected here and the two are
    // inserted just above it (skipped for surah 9, which has no بسملة).
    const surahStarts = json.verses
      .filter((v) => v.verse_number === 1)
      .map((v) => ({
        surah: Number(v.verse_key.split(":")[0]),
        beforeLine: v.words[0]?.line_number,
      }));

    return { lines, surahStarts };
  })();
  wordsCache.set(page, promise);
  try {
    return await promise;
  } catch (e) {
    wordsCache.delete(page);
    throw e;
  }
}

export async function loadPageFont(page) {
  const family = fontFamilyFor(page);
  if (fontCache.has(page)) {
    await fontCache.get(page);
    return family;
  }
  const padded = String(page).padStart(3, "0");
  const promise = (async () => {
    const face = new FontFace(family, `url(${FONT_BASE}/QCF2${padded}.ttf)`);
    await face.load();
    document.fonts.add(face);
  })();
  fontCache.set(page, promise);
  try {
    await promise;
  } catch (e) {
    fontCache.delete(page);
    throw e;
  }
  return family;
}
