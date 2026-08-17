import { useEffect, useState } from "react";

// Only worth showing when there is somewhere to scroll to: on a short page
// they were just two buttons sitting on top of the content. Each arrow
// hides on its own once you reach that end.
export default function ScrollButtons() {
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);

  useEffect(() => {
    function update() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      // A handful of pixels of overflow isn't worth a control.
      if (max < 120) {
        setCanUp(false);
        setCanDown(false);
        return;
      }
      const y = window.scrollY;
      setCanUp(y > 80);
      setCanDown(y < max - 80);
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    // Content grows as data loads, so re-measure when the page does.
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer.disconnect();
    };
  }, []);

  if (!canUp && !canDown) return null;

  return (
    <div className="scroll-buttons">
      {canUp && (
        <button
          type="button"
          className="scroll-btn"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          title="أعلى الصفحة"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 15l6-6 6 6" />
          </svg>
        </button>
      )}
      {canDown && (
        <button
          type="button"
          className="scroll-btn"
          onClick={() =>
            window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" })
          }
          title="أسفل الصفحة"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
