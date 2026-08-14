import { useRef, useState } from "react";
import { STUDY_PLAN, STUDY_PLAN_CREDIT } from "../data/studyPlan";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

function noteLines(note) {
  return note
    .split(/\s+ثم\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function fileNameFromUrl(url) {
  try {
    const last = decodeURIComponent(url.split("/").pop().split("?")[0]);
    return last || "audio.mp3";
  } catch {
    return "audio.mp3";
  }
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
    reportProgress({ progressPercent: percent, downloaded: true });
    setDownloading(true);
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileNameFromUrl(url);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // fallback: at least open it so the student can save it manually
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

function BookCard({ book, order }) {
  const { user, isAdmin } = useAuth();
  const lines = book.note ? noteLines(book.note) : [];
  const [selected, setSelected] = useState("");
  const [lessonIdx, setLessonIdx] = useState("");
  const [showNoPdf, setShowNoPdf] = useState(false);

  const idx = selected === "" ? null : Number(selected);
  const entry = idx !== null ? book.audio?.[idx] : null;
  const sheikhLabel = idx !== null ? lines[idx] : null;
  const isLessonSeries = Array.isArray(entry);
  const singleUrl = !isLessonSeries ? entry : null;
  const lesson = isLessonSeries && lessonIdx !== "" ? entry[Number(lessonIdx)] : null;

  function handlePdfClick() {
    if (book.pdfUrl) {
      window.open(book.pdfUrl, "_blank", "noreferrer");
    } else {
      setShowNoPdf(true);
    }
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
        <select
          className="study-plan-book-select"
          value={lessonIdx}
          onChange={(e) => setLessonIdx(e.target.value)}
        >
          <option value="" disabled>
            الدرس
          </option>
          {entry.map((l, li) => (
            <option key={li} value={li}>
              {l.title}
            </option>
          ))}
        </select>
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
