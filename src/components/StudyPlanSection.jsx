import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { STUDY_PLAN, STUDY_PLAN_CREDIT } from "../data/studyPlan";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

function noteLines(note) {
  return note
    .split(/\s+ثم\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim();
}

function composedFileName(book, sheikhLabel, lessonTitle) {
  const parts = [book.title, book.author, sheikhLabel, lessonTitle].filter(Boolean);
  return sanitizeFileName(parts.join(" - ")) + ".mp3";
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fetchAndSave(url, fileName) {
  const res = await fetch(url);
  const size = Number(res.headers.get("content-length")) || 0;
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
  return size || blob.size;
}

function AudioPlayer({ url, label, isAdmin, user, book, sheikhLabel }) {
  const [percent, setPercent] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const audioRef = useRef(null);
  const lastSentRef = useRef(0);

  function reportProgress(payload) {
    if (isAdmin || !user) return; // only track real students, not admin previews
    api
      .updateListeningProgress({
        studentId: user.uid,
        book: book.title,
        sheikh: label ? `${sheikhLabel} — ${label}` : sheikhLabel,
        ...payload,
      })
      .catch(() => {});
  }

  function handleTimeUpdate(e) {
    const { currentTime, duration } = e.target;
    if (!duration || Number.isNaN(duration)) return;
    const pct = Math.round((currentTime / duration) * 100);
    setPercent(pct);
    if (pct - lastSentRef.current >= 5 || pct === 100) {
      lastSentRef.current = pct;
      reportProgress({ progressPercent: pct });
    }
  }

  function handleReplay() {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
    reportProgress({ progressPercent: percent, replay: true });
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      await fetchAndSave(url, composedFileName(book, sheikhLabel, label));
      reportProgress({ progressPercent: percent, downloaded: true });
    } catch {
      window.open(url, "_blank", "noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="study-plan-audio">
      <audio
        ref={audioRef}
        controls
        src={url}
        className="study-plan-audio-player"
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => reportProgress({ progressPercent: 100 })}
        onError={() => setAudioError(true)}
      >
        متصفحك لا يدعم تشغيل الصوت مباشرة — استخدم زر التنزيل بدلًا من ذلك.
      </audio>

      {audioError && (
        <span className="study-plan-audio-missing">
          تعذّر تحميل الصوت — تحقّق من اتصال الإنترنت أو جرّب لاحقًا
        </span>
      )}

      <div className="study-plan-audio-row">
        <button type="button" className="study-plan-audio-replay" onClick={handleReplay}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 12a8 8 0 1 1 2.6 5.9" />
            <path d="M4 20v-5h5" />
          </svg>
          إعادة التشغيل
        </button>
        <button
          type="button"
          className="study-plan-audio-download"
          onClick={handleDownload}
          disabled={downloading}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
          </svg>
          {downloading ? "جارٍ التنزيل..." : "تنزيل"}
        </button>
      </div>

      {!isAdmin && percent > 0 && (
        <span className="study-plan-audio-percent">تم الاستماع: {percent}٪</span>
      )}
    </div>
  );
}

function NoPdfModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card no-pdf-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <p className="no-pdf-title">أهلًا وسهلًا أخي الكريم</p>
        <p className="no-pdf-text">لم يتم رفع أي ملف بعد، يرجى إخبار المعلم أو الشيخ</p>
      </div>
    </div>
  );
}

function DownloadAllPanel({ entry, book, sheikhLabel, downloadedSet, onClose, onFileDownloaded }) {
  const [sizes, setSizes] = useState({}); // idx -> bytes | null (loading) | undefined (unknown)
  const [status, setStatus] = useState({}); // idx -> "queued" | "downloading" | "done" | "error"
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    entry.forEach((lesson, i) => {
      fetch(lesson.url, { method: "HEAD" })
        .then((res) => {
          if (cancelled) return;
          const len = Number(res.headers.get("content-length"));
          setSizes((s) => ({ ...s, [i]: len || null }));
        })
        .catch(() => {
          if (!cancelled) setSizes((s) => ({ ...s, [i]: null }));
        });
    });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  const totalKnownBytes = Object.values(sizes).reduce((sum, v) => sum + (v || 0), 0);
  const doneCount = Object.values(status).filter((s) => s === "done").length;
  const remainingIdx = entry
    .map((_, i) => i)
    .filter((i) => !downloadedSet.has(`${sheikhLabel} — ${entry[i].title}`));

  async function startAll() {
    setRunning(true);
    for (const i of remainingIdx) {
      setStatus((s) => ({ ...s, [i]: "downloading" }));
      try {
        await fetchAndSave(entry[i].url, composedFileName(book, sheikhLabel, entry[i].title));
        setStatus((s) => ({ ...s, [i]: "done" }));
        onFileDownloaded(entry[i].title);
      } catch {
        setStatus((s) => ({ ...s, [i]: "error" }));
      }
    }
    setRunning(false);
  }

  return (
    <div className="download-all-panel">
      <div className="download-all-header">
        <span>تنزيل كل الدروس ({entry.length})</span>
        <button type="button" className="modal-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <ul className="download-all-list">
        {entry.map((lesson, i) => {
          const alreadyDone = downloadedSet.has(`${sheikhLabel} — ${lesson.title}`);
          const st = status[i] || (alreadyDone ? "done" : "queued");
          return (
            <li key={i} className="download-all-item">
              <span className="download-all-item-title">{lesson.title}</span>
              <span className="download-all-item-size">{formatBytes(sizes[i])}</span>
              <span className={`download-all-item-status status-${st}`}>
                {st === "done" ? "✓" : st === "downloading" ? "..." : st === "error" ? "✕" : ""}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="download-all-footer">
        <span>الحجم الإجمالي: {formatBytes(totalKnownBytes)}</span>
        {running && (
          <div className="leaderboard-bar download-all-bar">
            <div
              className="leaderboard-bar-fill"
              style={{ width: `${(doneCount / entry.length) * 100}%` }}
            />
          </div>
        )}
        <button type="button" onClick={startAll} disabled={running || remainingIdx.length === 0}>
          {running
            ? `جارٍ التنزيل... (${doneCount}/${entry.length})`
            : remainingIdx.length === 0
              ? "تم تنزيل كل الدروس"
              : `بدء تنزيل الكل (${remainingIdx.length} متبقّي)`}
        </button>
      </div>
    </div>
  );
}

function BookCard({ book, order }) {
  const { user, isAdmin } = useAuth();
  const lines = book.note ? noteLines(book.note) : [];
  const [selected, setSelected] = useState("");
  const [lessonIdx, setLessonIdx] = useState("");
  const [showNoPdf, setShowNoPdf] = useState(false);
  const [showDownloadAll, setShowDownloadAll] = useState(false);
  const [downloadedSet, setDownloadedSet] = useState(new Set());

  const idx = selected === "" ? null : Number(selected);
  const entry = idx !== null ? book.audio?.[idx] : null;
  const sheikhLabel = idx !== null ? lines[idx] : null;
  const isLessonSeries = Array.isArray(entry);
  const singleUrl = !isLessonSeries ? entry : null;
  const lesson = isLessonSeries && lessonIdx !== "" ? entry[Number(lessonIdx)] : null;

  useEffect(() => {
    if (!user || isAdmin) return;
    const unsub = onSnapshot(
      query(
        collection(db, "listeningProgress"),
        where("studentId", "==", user.uid),
        where("book", "==", book.title)
      ),
      (snap) => {
        const set = new Set();
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.downloaded) set.add(data.sheikh);
        });
        setDownloadedSet(set);
      }
    );
    return unsub;
  }, [user, isAdmin, book.title]);

  function handlePdfClick() {
    if (book.pdfUrl) {
      window.open(book.pdfUrl, "_blank", "noreferrer");
    } else {
      setShowNoPdf(true);
    }
  }

  function handleFileDownloaded(lessonTitle) {
    if (isAdmin || !user) return;
    api
      .updateListeningProgress({
        studentId: user.uid,
        book: book.title,
        sheikh: `${sheikhLabel} — ${lessonTitle}`,
        progressPercent: 0,
        downloaded: true,
      })
      .catch(() => {});
  }

  return (
    <li className="study-plan-book">
      <span className="study-plan-book-order">{order}</span>
      <span className="study-plan-book-title">{book.title}</span>
      {book.author && (
        <span className="study-plan-book-author">{book.author}</span>
      )}

      <div className="study-plan-book-actions-row">
        {lines.length > 0 ? (
          <select
            className="study-plan-book-select"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              setLessonIdx("");
            }}
          >
            <option value="" disabled>
              شرح بالصوت
            </option>
            {lines.map((line, li) => (
              <option key={li} value={li}>
                {line}
              </option>
            ))}
          </select>
        ) : (
          <span className="study-plan-book-select study-plan-book-select-disabled">
            شرح بالصوت
          </span>
        )}

        <button type="button" className="study-plan-book-select study-plan-pdf-btn" onClick={handlePdfClick}>
          كتاب PDF
        </button>
      </div>

      {idx !== null && isLessonSeries && (
        <>
          <select
            className="study-plan-book-select"
            value={lessonIdx}
            onChange={(e) => setLessonIdx(e.target.value)}
          >
            <option value="" disabled>
              الدرس
            </option>
            {entry.map((l, li) => {
              const done = downloadedSet.has(`${sheikhLabel} — ${l.title}`);
              return (
                <option key={li} value={li}>
                  {l.title} {done ? "✓" : ""}
                </option>
              );
            })}
          </select>

          <button
            type="button"
            className="study-plan-book-select study-plan-download-all-btn"
            onClick={() => setShowDownloadAll(true)}
          >
            تنزيل كل الدروس
          </button>
        </>
      )}

      {idx !== null && (
        <>
          {isLessonSeries ? (
            lesson ? (
              <AudioPlayer
                key={lesson.url}
                url={lesson.url}
                label={lesson.title}
                isAdmin={isAdmin}
                user={user}
                book={book}
                sheikhLabel={sheikhLabel}
              />
            ) : (
              <span className="study-plan-audio-missing">اختر الدرس لتشغيله</span>
            )
          ) : singleUrl ? (
            <AudioPlayer
              key={singleUrl}
              url={singleUrl}
              label={null}
              isAdmin={isAdmin}
              user={user}
              book={book}
              sheikhLabel={sheikhLabel}
            />
          ) : (
            <span className="study-plan-audio-missing">الصوت غير متوفر بعد</span>
          )}
        </>
      )}

      {showNoPdf && <NoPdfModal onClose={() => setShowNoPdf(false)} />}

      {showDownloadAll && isLessonSeries && (
        <div className="modal-overlay" onClick={() => setShowDownloadAll(false)}>
          <div className="modal-card download-all-modal" onClick={(e) => e.stopPropagation()}>
            <DownloadAllPanel
              entry={entry}
              book={book}
              sheikhLabel={sheikhLabel}
              downloadedSet={downloadedSet}
              onClose={() => setShowDownloadAll(false)}
              onFileDownloaded={handleFileDownloaded}
            />
          </div>
        </div>
      )}
    </li>
  );
}

export default function StudyPlanSection() {
  return (
    <div className="study-plan-inline">
      <div className="study-plan-body">
        {STUDY_PLAN.map((section) => (
          <div key={section.title} className="study-plan-section">
            <h4 className="study-plan-section-title">{section.title}</h4>
            <ol className="study-plan-books">
              {section.books.map((b, i) => (
                <BookCard key={i} book={b} order={i + 1} />
              ))}
            </ol>
          </div>
        ))}
      </div>

      <p className="study-plan-credit">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4Z" />
        </svg>
        {STUDY_PLAN_CREDIT}
      </p>
    </div>
  );
}
