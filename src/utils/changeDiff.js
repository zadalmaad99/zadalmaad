// Turns a queued write into rows a human can actually read. The raw patch
// is a Firestore blob (nested objects keyed by book title), which told the
// reviewer nothing about what actually changed — these rows pair the old
// value against the new one, field by field, and list only what differs.

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function show(v) {
  if (v === undefined || v === null || v === "") return "—";
  if (Array.isArray(v)) return v.length ? `${v.length} عنصرًا` : "—";
  if (isPlainObject(v)) {
    const keys = Object.keys(v);
    return keys.length ? keys.join("، ") : "—";
  }
  return String(v);
}

const FIELD_LABELS = {
  author: "المؤلف",
  note: "الشرح",
  order: "الترتيب",
  title: "العنوان",
  url: "الرابط",
  pdfUrl: "ملف PDF",
  pdfs: "ملفات PDF",
  hidden: "كتب مخفية",
  added: "كتب مضافة",
  edits: "تعديلات",
  bySheikh: "دروس الشيوخ",
};

function label(key) {
  return FIELD_LABELS[key] || key;
}

// Walks one or two levels deep — enough for the shapes this app queues
// (curriculumOverrides.edits[bookTitle].field, curriculumAudio.bySheikh[name])
// without turning into a general-purpose deep differ.
export function diffRows(before, after) {
  const rows = [];
  const b = before || {};
  const a = after || {};

  for (const key of Object.keys(a)) {
    const bv = b[key];
    const av = a[key];

    if (isPlainObject(av) && (isPlainObject(bv) || bv === undefined)) {
      const sub = bv || {};
      for (const k2 of Object.keys(av)) {
        if (isPlainObject(av[k2]) && (isPlainObject(sub[k2]) || sub[k2] === undefined)) {
          const s2 = sub[k2] || {};
          for (const k3 of Object.keys(av[k2])) {
            if (JSON.stringify(s2[k3]) === JSON.stringify(av[k2][k3])) continue;
            rows.push({ field: `${k2} — ${label(k3)}`, before: show(s2[k3]), after: show(av[k2][k3]) });
          }
        } else if (JSON.stringify(sub[k2]) !== JSON.stringify(av[k2])) {
          rows.push({ field: `${label(key)} — ${k2}`, before: show(sub[k2]), after: show(av[k2]) });
        }
      }
    } else if (JSON.stringify(bv) !== JSON.stringify(av)) {
      rows.push({ field: label(key), before: show(bv), after: show(av) });
    }
  }

  return rows;
}

export function changeKind(change) {
  if (change.remove) return { text: "حذف", cls: "delete" };
  if (!change.before) return { text: "إضافة", cls: "add" };
  return { text: "تعديل", cls: "edit" };
}
