import { useState } from "react";
import { useCurriculumPlan } from "../data/curriculum";
import { HADITH_BOOKS } from "../data/hadithBooks";
import MenhajCard from "./MenhajCard";
import StudyPlanSection from "./StudyPlanSection";
import HadithBooksSection from "./HadithBooksSection";

const TOTAL_HADITH = HADITH_BOOKS.reduce((sum, b) => sum + b.total, 0);

const HADITH_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 21c-2.2-1.6-4.8-2.4-7.5-2.4V5.6C7.2 5.6 9.8 6.4 12 8c2.2-1.6 4.8-2.4 7.5-2.4v13c-2.7 0-5.3.8-7.5 2.4Z" />
    <path d="M12 8v13" />
  </svg>
);

// The المنهج content (study-plan books + hadith six books) — shared between
// the logged-in dashboard and the public read-only page, since the book
// cards themselves already degrade gracefully to read-only when signed out.
export default function MenhajAccordion() {
  const [menhajSection, setMenhajSection] = useState(null);
  const { sections } = useCurriculumPlan();
  const sectionCount = sections.length;
  const bookCount = sections.reduce((sum, s) => sum + s.books.length + s.added.length, 0);

  return (
    <div className="menhaj-accordion">
      <MenhajCard
        active={menhajSection === "sunnah"}
        onClick={() => setMenhajSection((s) => (s === "sunnah" ? null : "sunnah"))}
        title="دراسة كتب السنة على منهاج النبوة"
        subtitle="منهج متدرّج في العقيدة والفقه والحديث واللغة، مع الشروح الصوتية وملفات PDF"
        icon={
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
          </svg>
        }
        stats={[
          { value: sectionCount, label: "بابًا علميًا" },
          { value: bookCount, label: "كتابًا" },
          { value: "صوت + PDF", label: "لكل كتاب" },
        ]}
      />
      {menhajSection === "sunnah" && <StudyPlanSection />}

      <MenhajCard
        active={menhajSection === "sixBooks"}
        onClick={() => setMenhajSection((s) => (s === "sixBooks" ? null : "sixBooks"))}
        title="دراسة الكتب الستة في الحديث"
        subtitle="متابعة حفظ وقراءة ومراجعة أحاديث الكتب الستة مع تتبّع التقدّم"
        icon={HADITH_ICON}
        stats={[
          { value: HADITH_BOOKS.length, label: "كتب" },
          { value: TOTAL_HADITH.toLocaleString("en-US"), label: "حديثًا" },
          { value: "حفظ · قراءة · مراجعة", label: "أقسام المتابعة" },
        ]}
      />
      {menhajSection === "sixBooks" && (
        <div className="menhaj-accordion-content">
          <HadithBooksSection />
        </div>
      )}
    </div>
  );
}
