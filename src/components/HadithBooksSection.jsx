import { useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useCurriculumPlan } from "../data/curriculum";
import { HADITH_STUDY_SECTION } from "../data/hadithStudyPlan";
import { HADITH_BOOKS } from "../data/hadithBooks";
import { StudyPlanSectionBlock } from "./StudyPlanSection";
import HadithTrackingSection from "./HadithTrackingSection";

const PLAN_SECTIONS = [HADITH_STUDY_SECTION];

const SUB_TABS = [
  { key: "hifz", label: "حفظ" },
  { key: "qiraah", label: "قراءة" },
  { key: "murajaah", label: "مراجعة" },
];

const HADITH_TITLES = {
  hifz: "سجلات حفظ المنهج",
  qiraah: "سجلات قراءة المنهج",
  murajaah: "سجلات مراجعة المنهج",
};

// Same section/book-card UI as the study plan (شرح بالصوت, PDF, superadmin
// edit/delete/reorder/add) — reused as-is via BookCard/ReorderPanel/AddBookForm
// — plus a "متابعة الطلاب" button per card that opens the existing
// hifz/qiraah/murajaah student tracking scoped to that one book.
export default function HadithBooksSection() {
  const { user, isSuperadmin } = useAuth();
  const { sections, overrides, saveOverrides } = useCurriculumPlan(PLAN_SECTIONS, "hadithBooks");
  const [addingSection, setAddingSection] = useState(null);
  const [reorderingSection, setReorderingSection] = useState(null);
  const [trackingBook, setTrackingBook] = useState(null); // { title, hadithKey } | null
  const [trackingSub, setTrackingSub] = useState("hifz");

  const section = sections[0];

  function handleSaveEdit(bookTitle, patch) {
    const nextEdits = { ...overrides.edits };
    const targetOrder = Math.min(Math.max(1, patch.order || 1), section.books.length);
    const book = section.books.find((b) => b.title === bookTitle);
    const reordered = section.books.filter((b) => b.title !== bookTitle);
    reordered.splice(targetOrder - 1, 0, book);
    reordered.forEach((b, i) => {
      nextEdits[b.title] = { ...(nextEdits[b.title] || {}), order: i + 1 };
    });
    nextEdits[bookTitle] = { ...(nextEdits[bookTitle] || {}), author: patch.author, note: patch.note };
    saveOverrides({ edits: nextEdits });
  }

  async function handleSaveOrder(orderedBooks) {
    const nextEdits = { ...overrides.edits };
    orderedBooks.forEach((b, i) => {
      nextEdits[b.title] = { ...(nextEdits[b.title] || {}), order: i + 1 };
    });
    await saveOverrides({ edits: nextEdits });
    setReorderingSection(null);
  }

  function handleDeleteBook(bookTitle) {
    saveOverrides({ hidden: [...overrides.hidden, bookTitle] });
  }

  function handleAddBook(newBook) {
    const existing = overrides.added[section.title] || [];
    saveOverrides({ added: { ...overrides.added, [section.title]: [...existing, newBook] } });
    setAddingSection(null);
  }

  function handleDeleteAddedBook(bookTitle) {
    const existing = overrides.added[section.title] || [];
    saveOverrides({
      added: { ...overrides.added, [section.title]: existing.filter((b) => b.title !== bookTitle) },
    });
  }

  if (!section) return null;

  return (
    <div className="study-plan-inline">
      <div className="study-plan-body">
        <StudyPlanSectionBlock
          section={section}
          isSuperadmin={isSuperadmin}
          reordering={reorderingSection === section.title}
          onStartReorder={() => setReorderingSection(section.title)}
          onCancelReorder={() => setReorderingSection(null)}
          onSaveOrder={handleSaveOrder}
          onSaveEdit={handleSaveEdit}
          onDeleteBook={handleDeleteBook}
          onDeleteAddedBook={handleDeleteAddedBook}
          adding={addingSection === section.title}
          onStartAdd={() => setAddingSection(section.title)}
          onCancelAdd={() => setAddingSection(null)}
          onAddBook={handleAddBook}
          bookCardExtra={(b) => {
            const hadithKey = b.hadithKey || HADITH_BOOKS.find((hb) => hb.name === b.title)?.key;
            return {
              trackingButton: hadithKey && user && (
                <button
                  type="button"
                  className="study-plan-tracking-btn"
                  onClick={() => {
                    setTrackingBook({ title: b.title, hadithKey });
                    setTrackingSub("hifz");
                  }}
                >
                  <span className="study-plan-tracking-btn-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="9" cy="7" r="3.2" />
                      <path d="M2.5 20c.7-3.6 3.3-5.6 6.5-5.6s5.8 2 6.5 5.6" />
                    </svg>
                  </span>
                  <span className="study-plan-tracking-btn-text">
                    <span className="study-plan-tracking-btn-title">متابعة الطلاب</span>
                    <span className="study-plan-tracking-btn-hint">انقر هنا لمراقبة تقدم الطالب</span>
                  </span>
                </button>
              ),
            };
          }}
        />
      </div>

      {trackingBook &&
        createPortal(
          <div className="modal-overlay" onClick={() => setTrackingBook(null)}>
            <div
              className="modal-card hadith-tracking-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" className="modal-close" onClick={() => setTrackingBook(null)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
              <h4 className="hadith-book-heading">{trackingBook.title}</h4>
              <div className="subnav">
                {SUB_TABS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={trackingSub === s.key ? "subnav-btn active" : "subnav-btn"}
                    onClick={() => setTrackingSub(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <HadithTrackingSection
                type={trackingSub}
                bookFilter={trackingBook.hadithKey}
                title={HADITH_TITLES[trackingSub]}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
