import { STUDY_PLAN, STUDY_PLAN_CREDIT } from "../data/studyPlan";

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
                  <li key={i} className="study-plan-book">
                    <span className="study-plan-book-order">{i + 1}</span>
                    <span className="study-plan-book-title">{b.title}</span>
                    {b.author && (
                      <span className="study-plan-book-author">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="8" r="3.2" />
                          <path d="M4.5 20c.7-3.6 3.4-5.6 7.5-5.6s6.8 2 7.5 5.6" />
                        </svg>
                        {b.author}
                      </span>
                    )}
                    {b.note && (
                      <span className="study-plan-book-note">{b.note}</span>
                    )}
                  </li>
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
