// The six books as a curriculum "section" so they can reuse the exact same
// book-card UI (شرح بالصوت / PDF / superadmin edit-delete-reorder) as the
// study-plan books. `hadithKey` links each card back to its HADITH_BOOKS
// entry for the student hifz/qiraah/murajaah tracking button.
export const HADITH_STUDY_SECTION = {
  title: "الكتب الستة في الحديث",
  books: [
    { title: "صحيح البخاري", author: "الإمام محمد بن إسماعيل البخاري", hadithKey: "bukhari" },
    { title: "صحيح مسلم", author: "الإمام مسلم بن الحجاج القشيري", hadithKey: "muslim" },
    { title: "سنن أبي داود", author: "الإمام سليمان بن الأشعث السجستاني", hadithKey: "abudawud" },
    { title: "جامع الترمذي", author: "الإمام محمد بن عيسى الترمذي", hadithKey: "tirmidhi" },
    { title: "سنن النسائي", author: "الإمام أحمد بن شعيب النسائي", hadithKey: "nasai" },
    { title: "سنن ابن ماجه", author: "الإمام محمد بن يزيد بن ماجه", hadithKey: "ibnmajah" },
  ],
};
