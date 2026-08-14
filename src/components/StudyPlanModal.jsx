import { useState } from "react";
import { STUDY_PLAN, STUDY_PLAN_CREDIT } from "../data/studyPlan";

function noteLines(note) {
  return note
    .split(/\s+ثم\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function BookCard({ book, order }) {
  const lines = book.note ? noteLines(book.note) : [];
  const [selected, setSelected] = useState("");
  const idx = selected === "" ? null : Number(selected);
  const audioUrl = idx !== null ? book.audio?.[idx] : null;

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
          onChange={(e) => setSelected(e.target.value)}
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
              <audio controls src={audioUrl} className="study-plan-audio-player" />
              <a
                href={audioUrl}
                download
                className="study-plan-audio-download"
                target="_blank"
                rel="noreferrer"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
                </svg>
                تنزيل
              </a>
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
