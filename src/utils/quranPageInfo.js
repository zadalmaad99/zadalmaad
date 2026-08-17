import pages from "../data/quranPages.json";
import { SURAHS } from "../data/surahs";

// The page data carries names as they appear in "سورةُ البقرةِ", i.e. already
// inflected for that construction — printed on their own they end on a stray
// kasra. The canonical list is the one to show.
const NAME_BY_NUMBER = new Map(SURAHS.map((s) => [s.number, s.name]));

export function surahNames(info) {
  if (!info) return "";
  return info.surahs.map((s) => NAME_BY_NUMBER.get(s.number) || s.name).join(" / ");
}

// Real per-page mushaf metadata (surah, juz, hizb, last ayah) fetched once
// from api.alquran.cloud's quran-uthmani edition — same 604-page Madani
// pagination as the page images themselves, baked in at build time so this
// works offline and never depends on a live API call in production.
const byPage = new Map(pages.map((p) => [p.page, p]));

export function getPageInfo(page) {
  return byPage.get(page) || null;
}

// First page each surah/juz begins on, derived from the same page table —
// so jumping never disagrees with what the header shows.
export const SURAH_STARTS = SURAHS.map((s) => {
  const first = pages.find((p) => p.surahs.some((x) => x.number === s.number));
  return { number: s.number, name: s.name, page: first ? first.page : 1 };
});

export const JUZ_STARTS = Array.from({ length: 30 }, (_, i) => {
  const n = i + 1;
  const first = pages.find((p) => p.juz.includes(n));
  return { number: n, page: first ? first.page : 1 };
});

// The fourteen places of prostration, on the reckoning that doesn't count
// سجدة ص among the عزائم. Page numbers come from the same Madani
// pagination as the page images. Verified against the quran-uthmani
// sajda listing, with ص (38:24, page 454) deliberately excluded.
export const SAJDAS = [
  { surah: "الأعراف", ayah: 206, page: 176 },
  { surah: "الرعد", ayah: 15, page: 251 },
  { surah: "النحل", ayah: 50, page: 272 },
  { surah: "الإسراء", ayah: 109, page: 293 },
  { surah: "مريم", ayah: 58, page: 309 },
  { surah: "الحج", ayah: 18, page: 334 },
  { surah: "الحج", ayah: 77, page: 341 },
  { surah: "الفرقان", ayah: 60, page: 365 },
  { surah: "النمل", ayah: 26, page: 379 },
  { surah: "السجدة", ayah: 15, page: 416 },
  { surah: "فصلت", ayah: 38, page: 480 },
  { surah: "النجم", ayah: 62, page: 528 },
  { surah: "الانشقاق", ayah: 21, page: 589 },
  { surah: "العلق", ayah: 19, page: 597 },
];

const SAJDA_BY_PAGE = new Map();
SAJDAS.forEach((s) => {
  if (!SAJDA_BY_PAGE.has(s.page)) SAJDA_BY_PAGE.set(s.page, []);
  SAJDA_BY_PAGE.get(s.page).push(s);
});

export function sajdasOnPage(page) {
  return SAJDA_BY_PAGE.get(page) || [];
}

export function hizbLabel(hizbQuarter) {
  if (!hizbQuarter) return null;
  const hizb = Math.ceil(hizbQuarter / 4);
  const quarterInHizb = ((hizbQuarter - 1) % 4) + 1;
  const quarterLabel = quarterInHizb === 1 ? "" : ` (الربع ${quarterInHizb})`;
  return `الحزب ${hizb}${quarterLabel}`;
}
