import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// A custom-styled replacement for a native <select> — mobile browsers render
// the native picker with zero app styling, so anywhere that stands out we
// swap it for this instead, matching the rest of the app's picker modals.
export default function SelectPickerModal({ title, options, selectedValue, onSelect, onClose }) {
  const selectedRef = useRef(null);

  // Jump straight to whichever option is selected — with a long list (e.g.
  // every book in the curriculum) the current pick can be scrolled well past
  // the visible area, and nobody wants to hunt for it by hand every time.
  useEffect(() => {
    selectedRef.current?.scrollIntoView({ block: "center" });
  }, []);

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card picker-modal-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <p className="picker-modal-title">{title}</p>
        <div className="picker-modal-list">
          {options.map((opt) => (
            <button
              key={opt.value}
              ref={opt.value === selectedValue ? selectedRef : null}
              type="button"
              className={`picker-modal-item${opt.value === selectedValue ? " selected" : ""}${opt.dimmed ? " dimmed" : ""}`}
              onClick={() => {
                onSelect(opt.value);
                onClose();
              }}
            >
              <span>{opt.label}</span>
              {opt.dimmed && opt.value !== selectedValue && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="picker-modal-item-done">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
              {opt.value === selectedValue && (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
