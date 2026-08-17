import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// pdf.js is a hefty dependency (~400KB) that most visitors never touch —
// load it only once someone actually opens a PDF, not on every page view.
let pdfjsLibPromise = null;
function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([lib, worker]) => {
      lib.GlobalWorkerOptions.workerSrc = worker.default;
      return lib;
    });
  }
  return pdfjsLibPromise;
}

function progressKey(url) {
  return `pdfprog_${url}`;
}

function readSavedPage(url) {
  try {
    return Number(localStorage.getItem(progressKey(url))) || 1;
  } catch {
    return 1;
  }
}

function saveCurrentPage(url, page) {
  try {
    localStorage.setItem(progressKey(url), String(page));
  } catch {
    // private-browsing / storage-quota — resuming just won't work, no big deal
  }
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

// A fullscreen in-app PDF reader — pdf.js renders each page onto a canvas so
// there's no external tab, and the last-read page is remembered per file.
export default function PdfViewerModal({ url, title, onClose }) {
  const canvasRef = useRef(null);
  const docRef = useRef(null);
  const renderTaskRef = useRef(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(() => readSavedPage(url));
  const [scale, setScale] = useState(1.2);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadPdfjs()
      .then((lib) => lib.getDocument({ url }).promise)
      .then((pdf) => {
        if (cancelled) return;
        docRef.current = pdf;
        setNumPages(pdf.numPages);
        setPageNum((p) => Math.min(Math.max(1, p), pdf.numPages));
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      docRef.current?.destroy?.();
      docRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    if (status !== "ready" || !docRef.current) return;
    let cancelled = false;
    docRef.current.getPage(pageNum).then((page) => {
      if (cancelled || !canvasRef.current) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      renderTaskRef.current?.cancel?.();
      const task = page.render({ canvasContext: canvas.getContext("2d"), viewport });
      renderTaskRef.current = task;
      task.promise.catch(() => {});
    });
    saveCurrentPage(url, pageNum);
    return () => {
      cancelled = true;
    };
  }, [status, pageNum, scale, url]);

  function goPrev() {
    setPageNum((p) => Math.max(1, p - 1));
  }
  function goNext() {
    setPageNum((p) => Math.min(numPages, p + 1));
  }
  function zoomIn() {
    setScale((s) => Math.min(MAX_SCALE, +(s + 0.2).toFixed(2)));
  }
  function zoomOut() {
    setScale((s) => Math.max(MIN_SCALE, +(s - 0.2).toFixed(2)));
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowRight") goPrev(); // RTL reading direction
    else if (e.key === "ArrowLeft") goNext();
    else if (e.key === "Escape") onClose();
  }

  return createPortal(
    <div className="pdf-viewer-overlay" onKeyDown={handleKeyDown} tabIndex={-1} ref={(el) => el?.focus()}>
      <div className="pdf-viewer-topbar">
        <span className="pdf-viewer-title">{title || "عرض الملف"}</span>
        <div className="pdf-viewer-topbar-actions">
          <a className="pdf-viewer-icon-btn" href={url} target="_blank" rel="noreferrer" title="تنزيل الملف" download>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
            </svg>
          </a>
          <button type="button" className="pdf-viewer-icon-btn" onClick={onClose} title="إغلاق" aria-label="إغلاق">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="pdf-viewer-body">
        {status === "loading" && <p className="pdf-viewer-status">جارٍ تحميل الملف...</p>}
        {status === "error" && (
          <p className="pdf-viewer-status pdf-viewer-status-error">
            تعذّر عرض الملف هنا. <a href={url} target="_blank" rel="noreferrer">افتحه في تبويب جديد</a> بدلًا من ذلك.
          </p>
        )}
        {status === "ready" && (
          <div className="pdf-viewer-page-wrap">
            <canvas ref={canvasRef} className="pdf-viewer-canvas" />
          </div>
        )}
      </div>

      {status === "ready" && (
        <div className="pdf-viewer-toolbar">
          <button type="button" className="pdf-viewer-icon-btn" onClick={zoomOut} disabled={scale <= MIN_SCALE} title="تصغير" aria-label="تصغير">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-3.8-3.8M8 11h6" />
            </svg>
          </button>
          <button type="button" className="pdf-viewer-icon-btn" onClick={zoomIn} disabled={scale >= MAX_SCALE} title="تكبير" aria-label="تكبير">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-3.8-3.8M11 8v6M8 11h6" />
            </svg>
          </button>

          <span className="pdf-viewer-page-indicator">
            صفحة {pageNum} من {numPages}
          </span>

          <button type="button" className="pdf-viewer-icon-btn" onClick={goNext} disabled={pageNum >= numPages} title="التالي" aria-label="الصفحة التالية">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 6 9 12l6 6" />
            </svg>
          </button>
          <button type="button" className="pdf-viewer-icon-btn" onClick={goPrev} disabled={pageNum <= 1} title="السابق" aria-label="الصفحة السابقة">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      )}
    </div>,
    document.body
  );
}
