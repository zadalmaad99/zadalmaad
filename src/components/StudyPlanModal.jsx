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

function BookCard({ book, order }) {
  const { user, isAdmin } = useAuth();
  const lines = book.note ? noteLines(book.note) : [];
  const [selected, setSelected] = useState("");
  const [percent, setPercent] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef(null);
  const lastSentRef = useRef(0);

  const idx = selected === "" ? null : Number(selected);
  const audioUrl = idx !== null ? book.audio?.[idx] : null;
  const sheikhLabel = idx !== null ? lines[idx] : null;

  function reportProgress(payload) {
    if (isAdmin || !user) return; // only track real students, not admin previews
    api
      .updateListeningProgress({
        studentId: user.uid,
        book: book.title,
        sheikh: sheikhLabel,
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
  }

  function handleDownloadClick() {
    reportProgress({ progressPercent: percent, downloaded: true });
  }

  return (
    <li className="study-plan-book">
      <span className="study-plan-book-order">{order}</span>
      <span className="study-plan-book-title">{book.title}</span>
      {book.author && (
        <span className="study-plan-book-author">{book.author}</span>
      )}

      {lines.length > 0 && (
        <select
          className="study-plan-book-select"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setPercent(0);
            setAudioError(false);
            lastSentRef.current = 0;
          }}
        >
          <option value="" disabled>
            الشرح
          </option>
          {lines.map((line, li) => (
            <option key={li} value={li}>
              {line}
            </option>
          ))}
        </select>
      )}

      {idx !== null && (
        <div className="study-plan-audio">
          {audioUrl ? (
            <>
              <audio
                ref={audioRef}
                controls
                src={audioUrl}
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
                <button
                  type="button"
                  className="study-plan-audio-replay"
                  onClick={handleReplay}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 12a8 8 0 1 1 2.6 5.9" />
                    <path d="M4 20v-5h5" />
                  </svg>
                  إعادة التشغيل
                </button>
                <a
                  href={audioUrl}
                  download
                  className="study-plan-audio-download"
                  target="_blank"
                  rel="noreferrer"
                  onClick={handleDownloadClick}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
                  </svg>
                  تنزيل
                </a>
              </div>

              {!isAdmin && percent > 0 && (
                <span className="study-plan-audio-percent">تم الاستماع: {percent}٪</span>
              )}
            </>
          ) : (
            <span className="study-plan-audio-missing">الصوت غير متوفر بعد</span>
          )}
        </div>
      )}
    </li>
  );
}

export default function StudyPlanModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card study-plan-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>دراسة الكتب بالتدريج</h3>
          <button type="button" className="modal-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

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
    </div>
  );
}
