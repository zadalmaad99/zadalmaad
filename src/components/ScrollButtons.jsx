export default function ScrollButtons() {
  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function scrollToBottom() {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  }

  return (
    <div className="scroll-buttons">
      <button
        type="button"
        className="scroll-btn"
        onClick={scrollToTop}
        title="أعلى الصفحة"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M6 15l6-6 6 6" />
        </svg>
      </button>
      <button
        type="button"
        className="scroll-btn"
        onClick={scrollToBottom}
        title="أسفل الصفحة"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}
