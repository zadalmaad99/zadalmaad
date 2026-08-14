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
                    <div className="study-plan-book-body">
                      <span className="study-plan-book-title">{b.title}</span>
                      {b.author && (
                        <span className="study-plan-book-author">{b.author}</span>
                      )}
                      {b.note && (
                        <span className="study-plan-book-note">{b.note}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <p className="study-plan-credit">{STUDY_PLAN_CREDIT}</p>
      </div>
    </div>
  );
}
