import { useEffect, useRef, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { noteLines, useCurriculumPlan } from "../data/curriculum";
import { HADITH_STUDY_SECTION } from "../data/hadithStudyPlan";
import SelectPickerModal from "./SelectPickerModal";
import { useAuth } from "../context/AuthContext";
import { applyOrQueue } from "../utils/pendingChanges";

const HADITH_PLAN_SECTIONS = [HADITH_STUDY_SECTION];

// Arabic file names arrive percent-encoded (%D8%B4...), which is unreadable in
// the review box. We show them decoded and re-encode on save, so what actually
// gets stored is byte-for-byte the same working URL either way.
function readableUrl(url) {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

// Shared between the archive.org and YouTube importers: figure out a lesson's
// place in the series from its title/file name (or an embedded track number),
// since upload/playlist order frequently doesn't match the actual lesson
// order the sheikh taught them in. Both comparisons must stay NUMERIC — a
// plain string sort puts "الدرس 10" before "الدرس 2".
function extractLessonNumber(text, track) {
  const trackNum = Number(String(track || "").match(/\d+/)?.[0]);
  if (trackNum) return trackNum;
  const fromText = text.match(/(?:الدرس|درس|الحلقة|المجلس)\s*(\d+)/);
  if (fromText) return Number(fromText[1]);
  // "3_12" / "3/12" / "3-12" / "3 من 12" — common when the number sits at the
  // end of the title, where a plain sort would compare the topic first and
  // shuffle the order. Sanity-check the pair so dates like "06-04-1444"
  // aren't mistaken for a lesson number.
  const partOf = text.match(/(\d+)\s*(?:_|\/|-|من)\s*(\d+)/);
  if (partOf) {
    const index = Number(partOf[1]);
    const total = Number(partOf[2]);
    if (index >= 1 && index <= total && total <= 300) return index;
  }
  // A bare number in brackets, e.g. "... آل الشيخ (7) - عقيدة".
  const inBrackets = text.match(/[([](\d+)[)\]]/);
  if (inBrackets) {
    const index = Number(inBrackets[1]);
    if (index >= 1 && index <= 300) return index;
  }
  // Unnumbered openers/closers still have an obvious position.
  if (/(مقدمة|المقدمة|تمهيد)/.test(text)) return -Infinity;
  if (/(الأخير|الاخير|الختام|الخاتمة)/.test(text)) return Infinity;
  return null;
}

function sortByLessonNumber(list, textOf, trackOf, fallbackKeyOf) {
  return [...list].sort((a, b) => {
    const na = extractLessonNumber(textOf(a), trackOf?.(a));
    const nb = extractLessonNumber(textOf(b), trackOf?.(b));
    if (na !== null && nb !== null && na !== nb) return na - nb;
    if (na !== null && nb === null) return -1; // unnumbered items last
    if (na === null && nb !== null) return 1;
    return String(fallbackKeyOf(a)).localeCompare(String(fallbackKeyOf(b)), undefined, {
      numeric: true,
    });
  });
}

function isYoutubeUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be";
  } catch {
    return false;
  }
}

// Same idea as StudyPlanSection's getYoutubeId, duplicated here since this
// file already has its own small URL-parsing helpers rather than importing
// across components for a two-line function.
function extractYoutubeVideoId(url) {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const embedMatch = u.pathname.match(/^\/(embed|shorts)\/([^/?#]+)/);
      if (embedMatch) return embedMatch[2];
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeAudioUrl(raw) {
  const trimmed = String(raw).trim();
  try {
    const u = new URL(trimmed);
    u.pathname = u.pathname
      .split("/")
      .map((seg) => {
        try {
          return encodeURIComponent(decodeURIComponent(seg));
        } catch {
          return encodeURIComponent(seg);
        }
      })
      .join("/");
    return u.toString();
  } catch {
    return trimmed;
  }
}

export default function CurriculumAudioSettings() {
  const { user } = useAuth();
  const { allBooks: studyBooks } = useCurriculumPlan();
  const { allBooks: hadithBooks } = useCurriculumPlan(HADITH_PLAN_SECTIONS, "hadithBooks");
  const [bookSource, setBookSource] = useState("study");
  const BOOKS = bookSource === "hadith" ? hadithBooks : studyBooks;
  const [bookTitle, setBookTitle] = useState("");
  const [sheikh, setSheikh] = useState("");
  const [bySheikh, setBySheikh] = useState({});
  const [savedPdfUrl, setSavedPdfUrl] = useState("");
  const [pdfUrlInput, setPdfUrlInput] = useState("");
  const [savingPdf, setSavingPdf] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState([]); // {title, sourceName, url}
  const [savingPreview, setSavingPreview] = useState(false);
  const [filledYoutubeTitles, setFilledYoutubeTitles] = useState(new Set());
  const [filledPdfTitles, setFilledPdfTitles] = useState(new Set());
  const [filledLoaded, setFilledLoaded] = useState(false);
  const [showBookPicker, setShowBookPicker] = useState(false);
  const bulkDetailsRef = useRef(null);
  const bookInitRef = useRef(false);

  const book = BOOKS.find((b) => b.title === bookTitle);
  const sheikhOptions = book?.note ? noteLines(book.note) : [];

  // One listener across every book's curriculumAudio doc, tracking YouTube
  // lessons and PDF files as two separate signals — drives the two ✓/✗
  // badges in the book picker and the "jump to the next book still missing
  // a YouTube link" default.
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "curriculumAudio"), (snap) => {
      const yt = new Set();
      const pdf = new Set();
      snap.docs.forEach((d) => {
        const data = d.data();
        const hasYoutube = Object.values(data?.bySheikh || {}).some(
          (arr) => Array.isArray(arr) && arr.some((l) => isYoutubeUrl(l?.url))
        );
        if (hasYoutube) yt.add(d.id);
        const hasPdf = !!data?.pdfUrl || (Array.isArray(data?.pdfs) && data.pdfs.length > 0);
        if (hasPdf) pdf.add(d.id);
      });
      setFilledYoutubeTitles(yt);
      setFilledPdfTitles(pdf);
      setFilledLoaded(true);
    });
    return unsub;
  }, []);

  // Static plan data can also ship a book with a pdfUrl baked in, on top of
  // whatever curriculumAudio has — fold those in too.
  const pdfFilledTitles = new Set(filledPdfTitles);
  BOOKS.forEach((b) => {
    if (b.pdfUrl) pdfFilledTitles.add(b.title);
  });

  // The book list arrives asynchronously (static plan + live overrides), and
  // completion status arrives separately — once both are ready, default to
  // the first book still missing its YouTube lesson link instead of always
  // book #1, and re-run whenever the source toggle switches to a list
  // bookTitle isn't part of (drops the previous source's selection).
  useEffect(() => {
    if (!BOOKS.length || !filledLoaded) return;
    if (bookInitRef.current && BOOKS.some((b) => b.title === bookTitle)) return;
    const firstUnfilled = BOOKS.find((b) => !filledYoutubeTitles.has(b.title));
    setBookTitle((firstUnfilled || BOOKS[0]).title);
    bookInitRef.current = true;
  }, [BOOKS, filledLoaded, filledYoutubeTitles, bookTitle]);

  // Keep the sheikh valid whenever the book — or its edited note — changes.
  useEffect(() => {
    if (!sheikhOptions.includes(sheikh)) {
      setSheikh(sheikhOptions[0] || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookTitle, book?.note]);

  useEffect(() => {
    if (!bookTitle) return;
    const unsub = onSnapshot(doc(db, "curriculumAudio", bookTitle), (snap) => {
      const data = snap.data();
      setBySheikh(data?.bySheikh || {});
      setSavedPdfUrl(data?.pdfUrl || "");
      setPdfUrlInput(data?.pdfUrl || "");
    });
    return unsub;
  }, [bookTitle]);

  const lessons = sheikh ? bySheikh[sheikh] || [] : [];

  async function saveLessons(nextLessons) {
    setSaving(true);
    try {
      const result = await applyOrQueue(user, {
        collectionName: "curriculumAudio",
        docId: bookTitle,
        patch: { bySheikh: { ...bySheikh, [sheikh]: nextLessons } },
        merge: true,
        action: "تعديل دروس",
        description: `${bookTitle} — ${sheikh} (${nextLessons.length} درسًا)`,
      });
      if (result.queued) {
        window.alert("تم إرسال التعديل لموافقة السوبر أدمن الأعلى — لن يظهر إلا بعد الموافقة.");
      }
    } catch {
      window.alert("تعذّر الحفظ — تحقّق من اتصال الإنترنت وحاول مجددًا");
    } finally {
      setSaving(false);
    }
  }

  async function handleAdd() {
    const t = title.trim();
    const u = url.trim();
    if (!t || !u || !sheikh) return;
    await saveLessons([...lessons, { title: t, url: normalizeAudioUrl(u) }]);
    setTitle("");
    setUrl("");
  }

  async function handleRemove(i) {
    await saveLessons(lessons.filter((_, li) => li !== i));
  }

  function parseBulkLines(text) {
    const nextTitles = [];
    let autoIndex = lessons.length + 1;
    text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => {
        // Allow spaces inside the URL — decoded Arabic names contain them.
        const sepMatch = line.match(/^(.*?)\s*[|\t]\s*(https?:\/\/.+)$/);
        if (sepMatch) {
          nextTitles.push({
            title: sepMatch[1].trim() || `الدرس ${autoIndex}`,
            url: normalizeAudioUrl(sepMatch[2]),
          });
        } else {
          nextTitles.push({ title: `الدرس ${autoIndex}`, url: normalizeAudioUrl(line) });
        }
        autoIndex += 1;
      });
    return nextTitles;
  }

  async function handleBulkAdd() {
    const parsed = parseBulkLines(bulkText).filter((l) => /^https?:\/\//.test(l.url));
    if (!parsed.length || !sheikh) return;
    setBulkSaving(true);
    try {
      await saveLessons([...lessons, ...parsed]);
      setBulkText("");
    } finally {
      setBulkSaving(false);
    }
  }

  function extractArchiveIdentifier(input) {
    const trimmed = input.trim();
    // archive.org URLs are consistently archive.org/<action>/<identifier>/...
    // (details, download, manage, edit, embed, stream, ...) so just grab the
    // path segment right after the first one instead of hardcoding actions.
    const match = trimmed.match(/archive\.org\/[a-z-]+\/([^/?#]+)/i);
    if (match) return decodeURIComponent(match[1]);
    if (/^[^\s/]+$/.test(trimmed)) return trimmed; // bare identifier
    return null;
  }

  function extractYoutubePlaylistId(input) {
    try {
      const u = new URL(input.trim());
      const host = u.hostname.toLowerCase().replace(/^www\./, "");
      if (host === "youtube.com" || host === "m.youtube.com" || host === "youtu.be") {
        return u.searchParams.get("list");
      }
      return null;
    } catch {
      return null;
    }
  }

  async function importYoutubePlaylist(playlistId) {
    const apiKey = import.meta.env.VITE_YOUTUBE_API_KEY;
    if (!apiKey) {
      window.alert("مفتاح YouTube API غير مُعدّ على الموقع بعد");
      return;
    }
    setImporting(true);
    try {
      let items = [];
      let pageToken = "";
      do {
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ""}`
        );
        const data = await res.json();
        if (data.error) throw new Error(data.error.message || "youtube api error");
        items = items.concat(data.items || []);
        pageToken = data.nextPageToken || "";
      } while (pageToken);

      const usable = items.filter(
        (it) =>
          it.snippet?.resourceId?.videoId &&
          it.snippet.title !== "Private video" &&
          it.snippet.title !== "Deleted video"
      );
      if (!usable.length) {
        window.alert("لم يُعثر على أي فيديوهات صالحة في هذه القائمة");
        return;
      }
      // Playlist order (however the channel owner arranged it) doesn't always
      // match the actual lesson order — prefer the number embedded in each
      // video's own title, falling back to playlist position when a video
      // has no such number.
      const sortedUsable = sortByLessonNumber(
        usable,
        (it) => it.snippet.title,
        () => null,
        (it) => it.snippet?.position ?? 0
      );
      const startAt = lessons.length + 1;
      setPreview(
        sortedUsable.map((it, i) => ({
          title: `الدرس ${startAt + i}`,
          sourceName: it.snippet.title,
          url: `https://www.youtube.com/watch?v=${it.snippet.resourceId.videoId}`,
        }))
      );
    } catch {
      window.alert("تعذّر جلب قائمة يوتيوب — تحقّق من الرابط أو حاول مجددًا");
    } finally {
      setImporting(false);
    }
  }

  // YouTube's public oEmbed endpoint — no API key needed, works for any
  // single public video.
  async function fetchYoutubeTitle(videoId) {
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`
      );
      if (!res.ok) throw new Error("oembed failed");
      const data = await res.json();
      return data.title || null;
    } catch {
      return null;
    }
  }

  // One or several plain YouTube video links (no ?list=, e.g. pasted one per
  // line when there's no actual playlist) — add them all as lessons instead
  // of erroring out just because it isn't a playlist link.
  async function importYoutubeVideoLinks(videoIds) {
    setImporting(true);
    try {
      const items = await Promise.all(
        videoIds.map(async (id, i) => ({ id, index: i, title: (await fetchYoutubeTitle(id)) || id }))
      );
      const sorted = sortByLessonNumber(items, (it) => it.title, () => null, (it) => it.index);
      const startAt = lessons.length + 1;
      setPreview(
        sorted.map((it, i) => ({
          title: `الدرس ${startAt + i}`,
          sourceName: it.title,
          url: `https://www.youtube.com/watch?v=${it.id}`,
        }))
      );
    } catch {
      window.alert("تعذّر جلب بيانات الفيديو — تحقّق من الروابط أو حاول مجددًا");
    } finally {
      setImporting(false);
    }
  }

  async function handleImportPlaylist() {
    const lines = playlistUrl.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    // Several lines pasted at once — support plain video links this way too,
    // not just an actual playlist link, since a lot of series never got
    // collected into one.
    if (lines.length > 1) {
      const videoIds = lines.map(extractYoutubeVideoId);
      if (videoIds.every(Boolean)) {
        await importYoutubeVideoLinks(videoIds);
        return;
      }
      window.alert("تأكد أن كل سطر رابط فيديو يوتيوب صالح (سطر واحد لكل رابط)");
      return;
    }

    const ytPlaylistId = extractYoutubePlaylistId(playlistUrl);
    if (ytPlaylistId) {
      await importYoutubePlaylist(ytPlaylistId);
      return;
    }

    const ytVideoId = extractYoutubeVideoId(playlistUrl);
    if (ytVideoId) {
      await importYoutubeVideoLinks([ytVideoId]);
      return;
    }

    const identifier = extractArchiveIdentifier(playlistUrl);
    if (!identifier) {
      window.alert("تعذّر التعرّف على معرّف العنصر — تأكد أن الرابط من archive.org/details/... أو رابط يوتيوب صالح");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
      const data = await res.json();
      // Uploads aren't always MP3 — archive.org labels m4a as "MPEG-4 Audio",
      // and also stores torrents/artwork/metadata alongside the audio. When it
      // has generated MP3 derivatives prefer those (widest playback support),
      // otherwise fall back to whatever audio the item actually holds.
      const audioFiles = (data.files || []).filter(
        (f) =>
          /(mp3|mpeg-4 audio|ogg|vorbis|flac|wave|aiff|opus|aac)/i.test(f.format || "") ||
          /\.(mp3|m4a|mp4|ogg|oga|opus|flac|wav|aac)$/i.test(f.name || "")
      );
      const mp3Files = audioFiles.filter((f) => /mp3/i.test(f.format || f.name || ""));
      const files = mp3Files.length ? mp3Files : audioFiles;
      if (!files.length) {
        window.alert("لم يُعثر على أي ملفات صوتية في هذا العنصر — قد يكون ما زال قيد المعالجة");
        return;
      }
      // Order the lessons as the sheikh published them, not however
      // archive.org happens to list the files.
      const sortedFiles = sortByLessonNumber(
        files,
        (f) => String(f.title || f.name),
        (f) => f.track,
        (f) => f.name
      );
      // Skip duplicate uploads: archive.org items sometimes contain the same
      // lesson uploaded more than once under a different file name, but the
      // embedded title metadata is identical — keep only the first copy.
      const seenTitles = new Set();
      const uniqueFiles = sortedFiles.filter((f) => {
        // Collapse whitespace too — re-uploads of the same lesson often differ
        // only by stray spaces in the embedded title.
        const key = (f.title || f.name).trim().toLowerCase().replace(/\s+/g, " ");
        if (seenTitles.has(key)) return false;
        seenTitles.add(key);
        return true;
      });
      const skipped = sortedFiles.length - uniqueFiles.length;
      // Show a readable review list — the Arabic name of each file next to the
      // number it will be saved under — instead of a wall of percent-encoded
      // URLs. The URL rides along invisibly on each row.
      const startAt = lessons.length + 1;
      setPreview(
        uniqueFiles.map((f, i) => ({
          title: `الدرس ${startAt + i}`,
          sourceName: (f.title || f.name.split("/").pop() || f.name).replace(/\.[^.]+$/, ""),
          url: `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`,
        }))
      );
      if (skipped > 0) {
        window.alert(`تم جلب ${uniqueFiles.length} درسًا، وتجاهلت ${skipped} ملفًا مكررًا (نفس العنوان).`);
      }
    } catch {
      window.alert("تعذّر جلب القائمة — تحقّق من اتصال الإنترنت أو صحة الرابط");
    } finally {
      setImporting(false);
    }
  }

  async function confirmPreview() {
    if (!preview.length || !sheikh) return;
    setSavingPreview(true);
    try {
      await saveLessons([
        ...lessons,
        ...preview.map((p) => ({ title: p.title.trim() || p.sourceName, url: p.url })),
      ]);
      setPreview([]);
      setPlaylistUrl("");
    } finally {
      setSavingPreview(false);
    }
  }

  function updatePreviewTitle(i, value) {
    setPreview((rows) => rows.map((r, ri) => (ri === i ? { ...r, title: value } : r)));
  }

  function removePreviewRow(i) {
    setPreview((rows) => rows.filter((_, ri) => ri !== i));
  }

  // Playlist order (archive.org track numbers, YouTube playlist position)
  // isn't always the sheikh's actual lesson order — let the admin fix it by
  // hand instead of re-importing. Renumbers "الدرس N" titles that still
  // match the auto-generated pattern so they stay in sync with the new
  // position; a title the admin already edited by hand is left alone.
  function movePreviewRow(i, delta) {
    setPreview((rows) => {
      const target = i + delta;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[i], next[target]] = [next[target], next[i]];
      return next.map((r, ri) => (/^الدرس \d+$/.test(r.title) ? { ...r, title: `الدرس ${ri + 1}` } : r));
    });
  }

  async function savePdfUrl(value) {
    setSavingPdf(true);
    try {
      const result = await applyOrQueue(user, {
        collectionName: "curriculumAudio",
        docId: bookTitle,
        patch: { pdfUrl: value || null },
        merge: true,
        action: value ? "تعديل رابط PDF" : "حذف رابط PDF",
        description: bookTitle,
      });
      if (result.queued) {
        window.alert("تم إرسال التعديل لموافقة السوبر أدمن الأعلى — لن يظهر إلا بعد الموافقة.");
      }
    } catch {
      window.alert("تعذّر الحفظ — تحقّق من اتصال الإنترنت وحاول مجددًا");
    } finally {
      setSavingPdf(false);
    }
  }

  function handleSavePdf() {
    return savePdfUrl(pdfUrlInput.trim());
  }

  function handleDeletePdf() {
    if (!window.confirm("هل تريد حذف رابط PDF المحفوظ لهذا الكتاب؟")) return;
    setPdfUrlInput("");
    return savePdfUrl("");
  }

  return (
    <div className="curriculum-settings-group">
      <div className="curriculum-settings-book-picker">
        <div className="curriculum-settings-source-toggle">
          <button
            type="button"
            className={bookSource === "study" ? "subnav-btn active" : "subnav-btn"}
            onClick={() => setBookSource("study")}
          >
            المنهج ({studyBooks.length} كتابًا)
          </button>
          <button
            type="button"
            className={bookSource === "hadith" ? "subnav-btn active" : "subnav-btn"}
            onClick={() => setBookSource("hadith")}
          >
            الحديث ({hadithBooks.length} كتب)
          </button>
        </div>

        <label className="curriculum-settings-field">
          <span>الكتاب (يُطبَّق على البطاقتين أدناه)</span>
          <button
            type="button"
            className="book-picker-trigger"
            onClick={() => setShowBookPicker(true)}
          >
            {bookTitle || "اختر الكتاب"}
          </button>
        </label>

        {filledLoaded && (
          <p className="curriculum-settings-book-legend">
            <span className="curriculum-settings-book-legend-dot yt" /> رابط يوتيوب
            <span className="curriculum-settings-book-legend-dot pdf" /> ملف PDF
            <span>— أخضر = موجود، رمادي = غير موجود</span>
          </p>
        )}
      </div>

      {showBookPicker && (
        <SelectPickerModal
          title="الكتاب"
          options={BOOKS.map((b) => ({
            value: b.title,
            label: b.title,
            badges: [
              { key: "yt", done: filledYoutubeTitles.has(b.title), title: "رابط يوتيوب" },
              { key: "pdf", done: pdfFilledTitles.has(b.title), title: "ملف PDF" },
            ],
          }))}
          selectedValue={bookTitle}
          onSelect={(v) => setBookTitle(v)}
          onClose={() => setShowBookPicker(false)}
        />
      )}

      <div className="settings-card curriculum-settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 3v4a1 1 0 0 0 1 1h4" />
            <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
            <path d="M9 13h6M9 17h6M9 9h1" />
          </svg>
          رفع ملف PDF
        </div>
        <p className="hint-text">
          رابط ملف PDF لهذا الكتاب (مثلًا من archive.org) — يظهر مباشرة عند ضغط زر
          "كتاب PDF" في قسم المنهج لكل المستخدمين.
        </p>

        <div className="curriculum-settings-pdf">
          <label className="curriculum-settings-field">
            <span>رابط ملف PDF</span>
            <input
              type="url"
              placeholder="مثلًا رابط من archive.org"
              value={pdfUrlInput}
              onChange={(e) => setPdfUrlInput(e.target.value)}
            />
          </label>
          <div className="curriculum-settings-pdf-actions">
            <button
              type="button"
              onClick={handleSavePdf}
              disabled={savingPdf || pdfUrlInput.trim() === savedPdfUrl}
            >
              {savingPdf ? "جارٍ الحفظ..." : "حفظ رابط PDF"}
            </button>
            {savedPdfUrl && (
              <button
                type="button"
                className="curriculum-settings-pdf-clear"
                onClick={handleDeletePdf}
                disabled={savingPdf}
              >
                حذف الرابط المحفوظ
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="settings-card curriculum-settings-card">
        <div className="settings-card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          رفع الصوتيات والروابط
        </div>
        <p className="hint-text">
          أضف روابط دروس صوتية (من archive.org أو أي موقع آخر) لكتاب وشيخ محددين،
          وستظهر مباشرة في قسم المنهج دون الحاجة لنشر تحديث للتطبيق.
        </p>

        <label className="curriculum-settings-field">
          <span>الشيخ</span>
          {sheikhOptions.length > 0 ? (
            <select value={sheikh} onChange={(e) => setSheikh(e.target.value)}>
              {sheikhOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <span className="curriculum-settings-empty">
              لا يوجد شرح مسجّل لهذا الكتاب في المنهج
            </span>
          )}
        </label>

        {sheikh && (
          <>
            {lessons.length > 0 && (
              <ul className="curriculum-settings-list">
                {lessons.map((l, i) => (
                  <li key={i}>
                    <span className="curriculum-settings-lesson-title">
                      {isYoutubeUrl(l.url) && (
                        <svg viewBox="0 0 24 24" fill="currentColor" className="curriculum-settings-youtube-icon">
                          <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 5 12 5 12 5s-6 0-7.7.3a2.7 2.7 0 0 0-1.9 1.9A28 28 0 0 0 2 12a28 28 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9C6 19 12 19 12 19s6 0 7.7-.3a2.7 2.7 0 0 0 1.9-1.9A28 28 0 0 0 22 12a28 28 0 0 0-.4-4.8ZM10 15V9l5 3-5 3Z" />
                        </svg>
                      )}
                      {l.title}
                    </span>
                    <button
                      type="button"
                      className="curriculum-settings-remove"
                      onClick={() => handleRemove(i)}
                      aria-label="حذف الدرس"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6 6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="curriculum-settings-add">
              <input
                type="text"
                placeholder="عنوان الدرس (مثلًا: الدرس 11)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <input
                type="url"
                placeholder="رابط ملف الصوت (mp3)"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAdd}
                disabled={saving || !title.trim() || !url.trim()}
              >
                {saving ? "جارٍ الحفظ..." : "إضافة الدرس"}
              </button>
            </div>

            <div className="curriculum-settings-playlist">
              <label className="curriculum-settings-field">
                <span>رابط قائمة الدروس (playlist)، أو عدة روابط فيديوهات يوتيوب منفصلة (سطر لكل رابط) — من archive.org أو يوتيوب</span>
                <textarea
                  rows={2}
                  placeholder={"archive.org/details/... أو youtube.com/playlist?list=...\nأو عدة روابط يوتيوب، رابط في كل سطر"}
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                />
              </label>
              <button type="button" onClick={handleImportPlaylist} disabled={importing || !playlistUrl.trim()}>
                {importing ? "جارٍ الجلب..." : "جلب كل الدروس تلقائيًا"}
              </button>
              <p className="hint-text">
                يجلب كل الدروس (صوتية من الأرشيف أو فيديوهات من يوتيوب) ويعرضها للمراجعة قبل الحفظ. يمكن أيضًا لصق عدة روابط فيديوهات يوتيوب منفصلة، رابط واحد في كل سطر، دون الحاجة لقائمة تشغيل فعلية.
              </p>
            </div>

            {preview.length > 0 && (
              <div className="import-preview">
                <p className="import-preview-title">
                  مراجعة قبل الإضافة ({preview.length} درسًا)
                </p>
                <p className="hint-text">
                  تأكّد من مطابقة الترقيم لاسم الدرس، وعدّل أي رقم أو احذف أي سطر قبل الحفظ.
                </p>
                <ul className="import-preview-list">
                  {preview.map((row, i) => (
                    <li key={i} className="import-preview-row">
                      <span className="import-preview-move">
                        <button
                          type="button"
                          onClick={() => movePreviewRow(i, -1)}
                          disabled={i === 0}
                          aria-label="تحريك لأعلى"
                          title="تحريك لأعلى"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                            <path d="M12 19V6M6 11l6-6 6 6" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => movePreviewRow(i, 1)}
                          disabled={i === preview.length - 1}
                          aria-label="تحريك لأسفل"
                          title="تحريك لأسفل"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                            <path d="M12 5v13M6 13l6 6 6-6" />
                          </svg>
                        </button>
                      </span>
                      <input
                        className="import-preview-num"
                        type="text"
                        value={row.title}
                        onChange={(e) => updatePreviewTitle(i, e.target.value)}
                        aria-label="رقم الدرس"
                      />
                      <span className="import-preview-name" title={row.sourceName}>
                        {row.sourceName}
                      </span>
                      <button
                        type="button"
                        className="import-preview-remove"
                        onClick={() => removePreviewRow(i)}
                        aria-label="حذف هذا الدرس"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="import-preview-actions">
                  <button type="button" onClick={confirmPreview} disabled={savingPreview}>
                    {savingPreview ? "جارٍ الحفظ..." : `إضافة كل الدروس (${preview.length})`}
                  </button>
                  <button
                    type="button"
                    className="import-preview-cancel"
                    onClick={() => setPreview([])}
                    disabled={savingPreview}
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}

            <details className="curriculum-settings-bulk" ref={bulkDetailsRef}>
              <summary>إضافة عدة دروس دفعة واحدة (للقوائم الطويلة)</summary>
              <p className="hint-text">
                الصق رابطًا واحدًا في كل سطر (سيُرقَّم الدرس تلقائيًا)، أو اكتب
                <code>العنوان | الرابط</code> في نفس السطر لتحديد عنوان مخصّص لكل درس.
              </p>
              <textarea
                rows={6}
                placeholder={"https://archive.org/download/.../1.mp3\nhttps://archive.org/download/.../2.mp3\nالدرس 3 | https://archive.org/download/.../3.mp3"}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
              <button
                type="button"
                onClick={handleBulkAdd}
                disabled={bulkSaving || !bulkText.trim()}
              >
                {bulkSaving ? "جارٍ الحفظ..." : "إضافة كل الروابط"}
              </button>
            </details>
          </>
        )}
      </div>
    </div>
  );
}
