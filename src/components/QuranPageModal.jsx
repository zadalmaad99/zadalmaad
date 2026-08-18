import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { getPageInfo, hizbLabel, surahNames, sajdasOnPage, SURAH_STARTS, JUZ_STARTS } from "../utils/quranPageInfo";
import { loadSurahRecitation, verseAtTime, RECITER_NAME, loadBasmalah, needsBasmalah } from "../utils/quranRecitation";
import { SURAHS } from "../data/surahs";
import { measureAyahSpans } from "../utils/measureAyahSpan";
import { baselineFraction } from "../utils/mushafLines";
import {
  FLIP_MODE_LABELS,
  getFlipMode,
  getFlipSpeed,
  getSoftness,
  nextFlipMode,
  playPageFlip,
  setFlipMode,
} from "../utils/pageFlipSound";

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
  const swipeRef = useRef(null);
  const soundMode = getFlipMode();
  const softness = getSoftness();

  function go(delta) {
    const next = Math.min(PAGE_COUNT, Math.max(1, page + delta));
    if (next === page) return;
    playPageFlip(softness, soundMode);
    setLoading(true);
    onPageChange(next);
  }

  function handleTouchStart(e) {
    if (e.touches.length !== 1) return;
    swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function handleTouchEnd(e) {
    // Reading the mushaf embedded in the tab (not just full-screen) should
    // turn by swipe too — that was the whole point of a book-like reader,
    // and having to reach for the "الصفحة التالية" button every line was
    // exactly the friction being complained about.
    const s = swipeRef.current;
    swipeRef.current = null;
    if (!s) return;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx > 0 ? 1 : -1);
  }

  return (
    <>
      <div
        className="quran-page-viewer"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {loading && <div className="quran-page-loading">جارٍ التحميل...</div>}
        <img
          src={pageUrl(page)}
          alt={`صفحة ${page}`}
          className="quran-page-img"
          onLoad={() => setLoading(false)}
          style={{ opacity: loading ? 0 : 1 }}
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="m9 18 6-6-6-6" />
          </svg>
          السابقة
        </button>
        <span className="hint-text">{page} / {PAGE_COUNT}</span>
        <button type="button" className="ghost" onClick={() => go(1)} disabled={page >= PAGE_COUNT}>
          التالية
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="m15 18-6-6 6-6" />
          </svg>
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
  const [soundMode, setSoundMode] = useState(() => getFlipMode());
  const flipMs = getFlipSpeed();
  const softness = getSoftness();
  const info = getPageInfo(page);
  const sajdas = sajdasOnPage(page);
  const [picker, setPicker] = useState(null); // "surah" | "juz" | null
  const [search, setSearch] = useState("");
  // Holds the page being turned away, so it can rotate out over the new one.
  const [turning, setTurning] = useState(null); // { page, dir } | null
  const pinchRef = useRef(null);
  const panRef = useRef(null);
  const swipeRef = useRef(null);
  const turnTimerRef = useRef(null);
  const pageRef = useRef(page);
  pageRef.current = page;

  // Reads pageRef instead of the `page` prop directly so it stays correct
  // when called from long-lived callbacks (the recitation timeupdate
  // listener below) whose closures were created on an earlier render.
  function goToPage(target) {
    const from = pageRef.current;
    const next = Math.min(PAGE_COUNT, Math.max(1, target));
    // Deliberately not blocked while a turn is still animating: at slow
    // speeds that swallowed every follow-up swipe for over a second and
    // made the reader feel dead. A new turn just restarts the animation.
    if (next === from) return;
    playPageFlip(softness, soundMode);
    // The outgoing sheet keeps rendering on top and rotates about the edge
    // it's bound on, revealing the new page underneath — the same motion as
    // turning a real leaf, rather than a cut or a fade.
    setTurning({ page: from, dir: next > from ? "fwd" : "back" });
    clearTimeout(turnTimerRef.current);
    turnTimerRef.current = setTimeout(() => setTurning(null), flipMs);
    setLoading(true);
    setScale(1);
    setOffset({ x: 0, y: 0 });
    onPageChange(next);
  }

  function go(delta) {
    goToPage(page + delta);
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
      // Also tracked at any zoom level: a fast, mostly-horizontal drag well
      // past normal panning distance still turns the page (see the
      // threshold below), so being zoomed in never traps the reader —
      // the قصيرة/توضيح buttons in the toolbar are the guaranteed fallback.
      swipeRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 1) {
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
    if (s) {
      const t = e.changedTouches?.[0];
      if (t) {
        const dx = t.clientX - s.x;
        const dy = t.clientY - s.y;
        // A much bigger threshold once zoomed in, so an ordinary pan never
        // fires it — but a real edge-to-edge sweep still turns the page,
        // instead of the reader being trapped unable to page while zoomed.
        const threshold = scale <= 1 ? 55 : 130;
        if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.8) go(dx > 0 ? 1 : -1);
      }
    }
    pinchRef.current = null;
    panRef.current = null;
    swipeRef.current = null;
    if (scale <= 1) setOffset({ x: 0, y: 0 });
  }

  function jumpTo(target, surahNumber) {
    setPicker(null);
    setSearch("");
    // Picking a surah while reciting has to actually restart the audio
    // there too — otherwise the page jumps but the audio (and the badge/
    // ruler with it) just keeps going from wherever it already was,
    // showing the wrong السورة entirely.
    if (reciting && surahNumber) {
      playSurah(surahNumber);
      return;
    }
    if (target === page) return;
    go(target - page);
  }

  const q = search.trim();
  const pickerItems =
    picker === "surah"
      ? SURAH_STARTS.filter((s) => !q || s.name.includes(q) || String(s.number) === q).map((s) => ({
          key: `s${s.number}`,
          number: s.number,
          label: s.name,
          page: s.page,
          active: !!info?.surahs.some((x) => x.number === s.number),
        }))
      : picker === "juz"
        ? JUZ_STARTS.filter((j) => !q || String(j.number) === q || `الجزء ${j.number}`.includes(q)).map((j) => ({
            key: `j${j.number}`,
            number: j.number,
            label: `الجزء ${j.number}`,
            page: j.page,
            active: !!info?.juz.includes(j.number),
          }))
        : [];

  // Reading along with الشيخ المنشاوي: fetches one surah's timing at a time
  // (cached across the session), turns the page itself when the audio
  // crosses onto the next one, and marks which ayah is playing. The mushaf
  // pages are photographs with no per-word coordinates, so there is no
  // reliable way to box the exact words — the indicator names the ayah
  // instead of drawing over it.
  const [reciting, setReciting] = useState(false);
  const [recitingBusy, setRecitingBusy] = useState(false);
  const [currentAyah, setCurrentAyah] = useState(null);
  const [readingBasmalah, setReadingBasmalah] = useState(false);
  const [recitationError, setRecitationError] = useState(null);
  const audioRef = useRef(null);
  const versesRef = useRef([]);
  // Read by the timeupdate listener below — a ref because that listener is
  // only re-attached when `reciting` changes, not on every render, so a
  // plain state read inside it would stay stale for the whole clip.
  const readingBasmalahRef = useRef(false);

  async function playSurah(surahNumber, seekVerseKey) {
    setRecitingBusy(true);
    setRecitationError(null);
    try {
      const { audioUrl, verses } = await loadSurahRecitation(surahNumber);
      versesRef.current = verses;
      let audio = audioRef.current;
      if (!audio) {
        audio = new Audio();
        audio.preload = "auto";
        audioRef.current = audio;
      }
      const startVerse = seekVerseKey ? verses.find((v) => v.verseKey === seekVerseKey) : verses[0];

      // Only recited when genuinely starting the surah fresh from its own
      // first ayah — resuming mid-surah shouldn't prepend it, same as a
      // real reciter wouldn't. While it plays, the ruler must stay off
      // ayah 1 entirely — beginners following along would otherwise be
      // taught the wrong words sit under the ruler.
      if (needsBasmalah(surahNumber) && startVerse?.verseKey === verses[0]?.verseKey) {
        readingBasmalahRef.current = true;
        setReadingBasmalah(true);
        setCurrentAyah(null);
        const bas = await loadBasmalah();
        await new Promise((resolve, reject) => {
          audio.src = bas.audioUrl;
          audio.currentTime = bas.from;
          audio.onended = null;
          function onTime() {
            if (audio.currentTime >= bas.to - 0.05) {
              audio.pause();
              audio.removeEventListener("timeupdate", onTime);
              resolve();
            }
          }
          audio.addEventListener("timeupdate", onTime);
          audio.play().catch(reject);
        });
        readingBasmalahRef.current = false;
        setReadingBasmalah(false);
      }

      audio.src = audioUrl;
      audio.currentTime = startVerse?.from || 0;
      audio.onended = () => {
        if (surahNumber < 114) playSurah(surahNumber + 1);
        else setReciting(false);
      };
      await audio.play();
      setReciting(true);
    } catch {
      setRecitationError("تعذّر تشغيل التلاوة — تحقّق من اتصال الإنترنت");
      setReciting(false);
    } finally {
      setRecitingBusy(false);
    }
  }

  function toggleRecitation() {
    if (reciting) {
      audioRef.current?.pause();
      setReciting(false);
      return;
    }
    // Start from the current page's first ayah, mid-surah if needed.
    const startSurah = info?.surahs[0]?.number;
    if (!startSurah) return;
    if (versesRef.current[0]?.surah === startSurah && audioRef.current) {
      const onThisPage = versesRef.current.find((v) => v.page === page);
      audioRef.current.currentTime = onThisPage?.from ?? 0;
      audioRef.current.play();
      setReciting(true);
    } else {
      loadSurahRecitation(startSurah).then(({ verses }) => {
        const onThisPage = verses.find((v) => v.page === page);
        playSurah(startSurah, onThisPage?.verseKey);
      });
    }
  }

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !reciting) return;
    function onTime() {
      // The بسملة clip is a few seconds of a *different* surah's (الفاتحة)
      // audio playing through this same element — looking up the target
      // surah's verse timings against it would resolve to ayah 1 by
      // coincidence and draw the ruler there before it's actually being
      // recited.
      if (readingBasmalahRef.current) return;
      const v = verseAtTime(versesRef.current, audio.currentTime);
      if (!v) return;
      setCurrentAyah((prev) => (prev?.verseKey === v.verseKey ? prev : v));
      if (v.page !== pageRef.current) goToPage(v.page);
    }
    audio.addEventListener("timeupdate", onTime);
    return () => audio.removeEventListener("timeupdate", onTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reciting]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
    },
    []
  );

  // Only the ayah's own horizontal span on its line(s) — not the full line
  // width — measured from the same font's real glyph widths so the ruler
  // is as short as the ayah itself, and starts/ends mid-line when an ayah
  // is split across a line break.
  const [rulerSpans, setRulerSpans] = useState([]); // [{ line, left, right }]
  const holderRef = useRef(null);
  useEffect(() => {
    if (!reciting || !currentAyah) {
      setRulerSpans([]);
      return;
    }
    let cancelled = false;
    const width = holderRef.current?.getBoundingClientRect().width;
    if (!width) return;
    measureAyahSpans(page, currentAyah.verseKey, width)
      .then((spans) => {
        if (!cancelled) setRulerSpans(spans);
      })
      .catch(() => {
        if (!cancelled) setRulerSpans([]);
      });
    return () => {
      cancelled = true;
    };
  }, [page, reciting, currentAyah]);

  return createPortal(
    <div className="quran-fs">
      {/* Right-to-left across its own strip: السورة، الجزء، الحزب.
          السورة and الجزء are pickers — choosing one jumps to its first page. */}
      <div className="quran-fs-place">
        <button
          type="button"
          className="quran-fs-surah quran-fs-jump"
          onClick={() => setPicker(picker === "surah" ? null : "surah")}
        >
          {info ? surahNames(info) : `صفحة ${page}`}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <button
          type="button"
          className="quran-fs-juz quran-fs-jump"
          onClick={() => setPicker(picker === "juz" ? null : "juz")}
        >
          {info ? `الجزء ${info.juz.join("-")}` : "الجزء"}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <span className="quran-fs-hizb">{info ? hizbLabel(info.hizbQuarter) : ""}</span>
      </div>

      {/* Names the ayah currently being recited — the page is a photograph
          with no per-word coordinates, so this is a named indicator rather
          than a box drawn over the exact words. */}
      {readingBasmalah && (
        <div className="quran-fs-ayah-badge basmalah">
          <svg viewBox="0 0 24 24" fill="currentColor" className="quran-fs-pulse-dot">
            <circle cx="12" cy="12" r="5" />
          </svg>
          البسملة
        </div>
      )}
      {reciting && !readingBasmalah && currentAyah && (
        <div className="quran-fs-ayah-badge">
          <svg viewBox="0 0 24 24" fill="currentColor" className="quran-fs-pulse-dot">
            <circle cx="12" cy="12" r="5" />
          </svg>
          {SURAHS.find((s) => s.number === currentAyah.surah)?.name} — آية {currentAyah.ayah}
        </div>
      )}
      {recitationError && <div className="quran-fs-recite-error">{recitationError}</div>}

      {picker && (
        <div className="quran-fs-picker">
          <div className="quran-fs-picker-head">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={picker === "surah" ? "ابحث عن سورة..." : "ابحث عن جزء..."}
            />
            <button type="button" onClick={() => setPicker(null)} aria-label="إغلاق">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ul className="quran-fs-picker-list">
            {pickerItems.map((it) => (
              <li key={it.key}>
                <button
                  type="button"
                  className={it.active ? "active" : ""}
                  onClick={() => jumpTo(it.page, picker === "surah" ? it.number : null)}
                >
                  <span className="quran-fs-picker-num">{it.number}</span>
                  <span className="quran-fs-picker-name">{it.label}</span>
                  <span className="quran-fs-picker-page">صفحة {it.page}</span>
                </button>
              </li>
            ))}
            {pickerItems.length === 0 && <li className="quran-fs-picker-empty">لا توجد نتيجة</li>}
          </ul>
        </div>
      )}

      <div className="quran-fs-bar">
        {/* التلاوة مع الشيخ المنشاوي — تشغيل/إيقاف، مع تقليب الصفحة تلقائيًا. */}
        <button
          type="button"
          className={reciting ? "quran-fs-recite active" : "quran-fs-recite"}
          onClick={toggleRecitation}
          disabled={recitingBusy}
          title={`تلاوة ${RECITER_NAME}`}
          aria-label={reciting ? "إيقاف التلاوة" : "تشغيل التلاوة"}
        >
          {recitingBusy ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="quran-fs-spin">
              <path d="M21 12a9 9 0 1 1-9-9" />
            </svg>
          ) : reciting ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 5h3v14H7zM14 5h3v14h-3z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7Z" />
            </svg>
          )}
          <span>تلاوة</span>
        </button>
        {/* Sound on/off; the softness itself is tuned in الإعدادات. */}
        <button
          type="button"
          className="quran-fs-sound"
          onClick={() => {
            const next = nextFlipMode(soundMode);
            setSoundMode(next);
            setFlipMode(next);
            playPageFlip(softness, next);
          }}
          aria-label={`صوت التقليب: ${FLIP_MODE_LABELS[soundMode]} — اضغط للتغيير`}
          title="صوت تقليب الصفحات"
        >
          {soundMode === "off" ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5 6 9H3v6h3l5 4V5Z" />
              <path d="m22 9-6 6m0-6 6 6" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 5 6 9H3v6h3l5 4V5Z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
            </svg>
          )}
          <span>{soundMode === "off" ? "صامت" : "الصوت"}</span>
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
        {/* The original printed page, untouched — the ruler is drawn over
            it rather than the artwork being rebuilt. */}
        <div
          ref={holderRef}
          className="quran-fs-page-holder"
          style={{
            // Fade rather than swap — a hard cut between pages feels jarring
            // next to a soft turning sound.
            opacity: loading ? 0 : 1,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        >
          <img
            src={pageUrl(page)}
            alt={`صفحة ${page}`}
            className="quran-fs-img"
            onLoad={() => setLoading(false)}
          />
          {rulerSpans.map((s) => {
            const top = baselineFraction(page, s.line);
            return top == null ? null : (
              <span
                key={s.line}
                className="quran-fs-ruler"
                style={{
                  top: `${top * 100}%`,
                  left: `${s.left * 100}%`,
                  width: `${(s.right - s.left) * 100}%`,
                }}
              />
            );
          })}
        </div>

        {turning && (
          <img
            key={turning.page}
            src={pageUrl(turning.page)}
            alt=""
            aria-hidden="true"
            className={`quran-fs-turning ${turning.dir}`}
            style={{ animationDuration: `${flipMs}ms` }}
          />
        )}

        {/* At the outer edges rather than over the toolbar — kept away
            from the text itself, which is what made the earlier top-row
            buttons unpleasant. */}
        <button
          type="button"
          className="quran-fs-edge-arrow prev"
          onClick={() => go(-1)}
          disabled={page <= 1}
          aria-label="الصفحة السابقة"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
        <button
          type="button"
          className="quran-fs-edge-arrow next"
          onClick={() => go(1)}
          disabled={page >= PAGE_COUNT}
          aria-label="الصفحة التالية"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
      </div>

      <div className="quran-fs-foot">
        {sajdas.length > 0 && (
          <span className="quran-fs-sajda" title={sajdas.map((s) => `${s.surah} ${s.ayah}`).join(" · ")}>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm-6.6 14.2c-.5 0-.9-.4-.9-.9 0-.4.3-.8.7-.9l4.6-1.1 1.4-3.6c.3-.7 1-1.1 1.7-.9.5.1.9.5 1.1 1l1 3 3.4 1.3c.4.2.7.5.7.9 0 .5-.4.9-.9.9H5.4Zm-1.2 2.3h15.6c.5 0 .9.4.9.9s-.4.9-.9.9H4.2c-.5 0-.9-.4-.9-.9s.4-.9.9-.9Z" />
            </svg>
            موضع سجدة
          </span>
        )}
        <span className="quran-fs-pageno">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 4.5C4 3.7 4.7 3 5.5 3H12v18H5.5c-.8 0-1.5-.7-1.5-1.5v-15Z" />
            <path d="M20 4.5c0-.8-.7-1.5-1.5-1.5H12v18h6.5c.8 0 1.5-.7 1.5-1.5v-15Z" />
          </svg>
          {page}
        </span>
      </div>
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
