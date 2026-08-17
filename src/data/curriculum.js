import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { STUDY_PLAN } from "./studyPlan";
import { useAuth } from "../context/AuthContext";
import { applyOrQueue } from "../utils/pendingChanges";

export function noteLines(note) {
  return note
    .split(/\s+ثم\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const EMPTY_OVERRIDES = { hidden: [], edits: {}, added: {} };

/**
 * Single source of truth for the curriculum: the static STUDY_PLAN merged with
 * the superadmin's live edits/deletions/additions stored in Firestore.
 * Both the المنهج section and the settings panel read from this so an edit made
 * in one place shows up everywhere immediately.
 */
export function useCurriculumPlan(planSections = STUDY_PLAN, overridesDocId = "global") {
  const { user } = useAuth();
  const [overrides, setOverrides] = useState(EMPTY_OVERRIDES);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "curriculumOverrides", overridesDocId), (snap) => {
      const data = snap.data();
      setOverrides({
        hidden: data?.hidden || [],
        edits: data?.edits || {},
        added: data?.added || {},
      });
    });
    return unsub;
  }, [overridesDocId]);

  async function saveOverrides(patch, description) {
    try {
      const result = await applyOrQueue(user, {
        collectionName: "curriculumOverrides",
        docId: overridesDocId,
        patch,
        merge: true,
        action: "تعديل المنهج",
        description: description || JSON.stringify(patch).slice(0, 200),
      });
      if (result.queued) {
        window.alert("تم إرسال التعديل لموافقة السوبر أدمن الأعلى — لن يظهر إلا بعد الموافقة.");
      }
    } catch {
      window.alert("تعذّر الحفظ — تحقّق من اتصال الإنترنت وحاول مجددًا");
    }
  }

  const sections = planSections.map((section) => {
    const staticBooks = section.books
      .filter((b) => !overrides.hidden.includes(b.title))
      .map((b) => ({ ...b, isAdded: false }));
    const addedBooks = (overrides.added[section.title] || []).map((b) => ({ ...b, isAdded: true }));

    // Merge edits (author/note/manual order number) onto each book, falling
    // back to its natural position so books without a manual number still
    // sort predictably and show a sensible badge.
    const books = [...staticBooks, ...addedBooks].map((b, i) => {
      const edit = overrides.edits[b.title];
      const merged = edit ? { ...b, ...edit } : b;
      const sortOrder = merged.order != null && merged.order !== "" ? Number(merged.order) : i + 1;
      return { ...merged, sortOrder };
    });
    books.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title, "ar"));
    // The badge shown on every card (and in the reorder panel) must always be
    // the book's exact position — never the raw stored number, which can have
    // gaps or collide with another book's manual number.
    books.forEach((b, i) => {
      b.order = i + 1;
    });

    return { ...section, books, added: books.filter((b) => b.isAdded) };
  });

  const allBooks = sections.flatMap((s) => s.books);

  return { sections, allBooks, overrides, saveOverrides };
}
