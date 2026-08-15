import { useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "../context/AuthContext";
import { useCurriculumPlan } from "../data/curriculum";
import { HADITH_STUDY_SECTION } from "../data/hadithStudyPlan";
import { HADITH_BOOKS } from "../data/hadithBooks";
import { BookCard, AddBookForm, ReorderPanel } from "./StudyPlanSection";
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
  const { isSuperadmin } = useAuth();
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
        <div className="study-plan-section">
          <div className="study-plan-section-head">
            <h4 className="study-plan-section-title">{section.title}</h4>
            {isSuperadmin && reorderingSection !== section.title && (
              <button
                type="button"
                className="study-plan-reorder-toggle"
                onClick={() => setReorderingSection(section.title)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                </svg>
                تعديل التسلسل
              </button>
            )}
          </div>

          {reorderingSection === section.title ? (
            <ReorderPanel
              books={section.books}
              onSave={handleSaveOrder}
              onCancel={() => setReorderingSection(null)}
            />
          ) : (
            <ol className="study-plan-books">
              {section.books.map((b) => {
                const hadithKey = b.hadithKey || HADITH_BOOKS.find((hb) => hb.name === b.title)?.key;
                return (
                  <BookCard
                    key={b.title}
                    book={b}
                    order={b.order}
                    onSaveEdit={handleSaveEdit}
                    onDeleteBook={
                      b.isAdded ? () => handleDeleteAddedBook(b.title) : handleDeleteBook
                    }
                    trackingButton={
                      hadithKey && (
                        <button
                          type="button"
                          className="study-plan-book-select study-plan-tracking-btn"
                          onClick={() => {
                            setTrackingBook({ title: b.title, hadithKey });
                            setTrackingSub("hifz");
                          }}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="9" cy="7" r="3.2" />
                            <path d="M2.5 20c.7-3.6 3.3-5.6 6.5-5.6s5.8 2 6.5 5.6" />
                          </svg>
                          متابعة الطلاب
                        </button>
                      )
                    }
                  />
                );
              })}
              {isSuperadmin &&
                (addingSection === section.title ? (
                  <AddBookForm onAdd={handleAddBook} onCancel={() => setAddingSection(null)} />
                ) : (
                  <li className="study-plan-book study-plan-book-add-trigger">
                    <button type="button" onClick={() => setAddingSection(section.title)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      إضافة كتاب
                    </button>
                  </li>
                ))}
            </ol>
          )}
        </div>
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
