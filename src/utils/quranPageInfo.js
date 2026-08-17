import pages from "../data/quranPages.json";

// Real per-page mushaf metadata (surah, juz, hizb, last ayah) fetched once
// from api.alquran.cloud's quran-uthmani edition — same 604-page Madani
// pagination as the page images themselves, baked in at build time so this
// works offline and never depends on a live API call in production.
const byPage = new Map(pages.map((p) => [p.page, p]));

export function getPageInfo(page) {
  return byPage.get(page) || null;
}

export function hizbLabel(hizbQuarter) {
  if (!hizbQuarter) return null;
  const hizb = Math.ceil(hizbQuarter / 4);
  const quarterInHizb = ((hizbQuarter - 1) % 4) + 1;
  const quarterLabel = quarterInHizb === 1 ? "" : ` (الربع ${quarterInHizb})`;
  return `الحزب ${hizb}${quarterLabel}`;
}
