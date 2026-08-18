// Reads the mushaf out loud with الشيخ محمد صديق المنشاوي (مرتّل) and turns
// the page automatically to follow along — driven by per-ayah timing data
// from quran.com's public API, fetched once per surah and cached in memory
// for the rest of the session (114 surahs, so this stays small).
export const RECITER_ID = 9; // Mohamed Siddiq al-Minshawi — Murattal
export const RECITER_NAME = "الشيخ محمد صديق المنشاوي";

const cache = new Map();

// Merges two calls (verse → page, and verse → audio timing) into one
// ordered list per surah: [{ verseKey, surah, ayah, page, from, to }],
// from/to in seconds.
export async function loadSurahRecitation(surahNumber) {
  if (cache.has(surahNumber)) return cache.get(surahNumber);

  const promise = (async () => {
    const [versesRes, audioRes] = await Promise.all([
      fetch(
        `https://api.qurancdn.com/api/qdc/verses/by_chapter/${surahNumber}?per_page=300&fields=verse_key,page_number`
      ),
      fetch(
        `https://api.qurancdn.com/api/qdc/audio/reciters/${RECITER_ID}/audio_files?chapter=${surahNumber}&segments=true`
      ),
    ]);
    if (!versesRes.ok || !audioRes.ok) throw new Error("تعذّر جلب بيانات التلاوة");
    const versesJson = await versesRes.json();
    const audioJson = await audioRes.json();

    const pageByKey = new Map(versesJson.verses.map((v) => [v.verse_key, v.page_number]));
    const audioFile = audioJson.audio_files?.[0];
    if (!audioFile) throw new Error("لا يوجد تسجيل صوتي لهذه السورة");

    const verses = audioFile.verse_timings
      .map((t) => {
        const [, ayah] = t.verse_key.split(":").map(Number);
        return {
          verseKey: t.verse_key,
          surah: surahNumber,
          ayah,
          page: pageByKey.get(t.verse_key) || null,
          from: t.timestamp_from / 1000,
          to: t.timestamp_to / 1000,
        };
      })
      .filter((v) => v.page != null)
      .sort((a, b) => a.from - b.from);

    return { audioUrl: audioFile.audio_url, verses };
  })();

  cache.set(surahNumber, promise);
  try {
    return await promise;
  } catch (e) {
    cache.delete(surahNumber);
    throw e;
  }
}

// Binary search for the verse whose [from, to) window contains `time`.
export function verseAtTime(verses, time) {
  let lo = 0,
    hi = verses.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const v = verses[mid];
    if (time < v.from) hi = mid - 1;
    else if (time >= v.to) lo = mid + 1;
    else return v;
  }
  // Between two verses' rounding, or past the last one — clamp to nearest.
  if (verses.length && time >= verses[verses.length - 1].to) return verses[verses.length - 1];
  return verses[Math.max(0, lo)] || null;
}
