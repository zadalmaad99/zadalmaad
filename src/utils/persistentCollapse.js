import { useState } from "react";

const STORAGE_KEY = "menhaj_section_collapsed";

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

// Remembers whether a باب section is collapsed or open, per section title,
// surviving a full refresh — sections open by default until the viewer
// collapses one themselves.
export function useSectionCollapse(key) {
  const [collapsed, setCollapsed] = useState(() => !!readAll()[key]);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        const all = readAll();
        all[key] = next;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      } catch {
        // private-browsing / storage-quota — the toggle still works this session
      }
      return next;
    });
  }

  return [collapsed, toggle];
}
