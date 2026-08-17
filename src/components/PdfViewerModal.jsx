import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

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

// Served from public/pdfjs (mirrored from pdfjs-dist at build time). Without
// these, a PDF that doesn't embed its fonts — Arial, Times New Roman — has
// no glyph data to fall back on, and Identity-H text has no CMap table, so
// Arabic renders with its letters unjoined and out of order.
const PDFJS_ASSET_BASE = `${import.meta.env.BASE_URL}pdfjs/`;
const PDF_DOC_OPTIONS = {
  cMapUrl: `${PDFJS_ASSET_BASE}cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${PDFJS_ASSET_BASE}standard_fonts/`,
};

function formatEta(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return "…";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} ثانية`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return s ? `${m} د ${s} ث` : `${m} دقيقة`;
  return `${Math.floor(m / 60)} س ${m % 60} د`;
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileNameFromUrl(url, title) {
  try {
    const last = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    if (last.toLowerCase().endsWith(".pdf")) return last;
  } catch {
    // fall through to the title-based name below
  }
  return `${(title || "ملف").replace(/[\\/:*?"<>|]/g, "_")}.pdf`;
}

// Exported so book cards can show a "تقدمك في القراءة" bar without
// re-opening the viewer — kept per-account like the video progress, so a
// shared device doesn't leak one person's reading position to the next.
export function pdfProgressKey(url, uid) {
  return `pdfprog_${uid || "anon"}_${url}`;
}

export function readPdfProgress(url, uid) {
  try {
    const raw = localStorage.getItem(pdfProgressKey(url, uid));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readSavedPage(url, uid) {
  return readPdfProgress(url, uid)?.page || 1;
}

function savePdfProgress(url, uid, page, numPages) {
  try {
    localStorage.setItem(pdfProgressKey(url, uid), JSON.stringify({ page, numPages }));
  } catch {
    // private-browsing / storage-quota — resuming just won't work, no big deal
  }
}

export function pdfProgressDocId(uid, url) {
  // Firestore doc IDs can't contain "/", and the raw URL is full of them.
  let h = 0;
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) | 0;
  return `${uid}_${h}`;
}

// Mirrors the video-progress sync in StudyPlanSection.jsx so the owner's
// "تقدّم كل المستخدمين" panel can also see PDF reading progress, not just
// YouTube — previously this only ever lived in localStorage and never
// reached Firestore at all, so the admin view showed nothing for it.
function syncPdfProgressToCloud(url, user, page, numPages, title) {
  if (!user?.uid || !numPages) return;
  setDoc(
    doc(db, "pdfProgress", pdfProgressDocId(user.uid, url)),
    {
      uid: user.uid,
      email: user.email || null,
      url,
      title: title || null,
      page,
      numPages,
      percent: Math.min(100, Math.round((page / numPages) * 100)),
      updatedAt: Date.now(),
    },
    { merge: true }
  ).catch(() => {});
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

// A fullscreen in-app PDF reader — pdf.js renders each page onto a canvas so
// there's no external tab, and the last-read page is remembered per file.
export default function PdfViewerModal({ url, title, onClose }) {
  const { user } = useAuth();
  const uid = user?.uid;
  const canvasRef = useRef(null);
  const pageWrapRef = useRef(null);
  const docRef = useRef(null);
  const renderTaskRef = useRef(null);
  const pinchRef = useRef(null); // { startDist, startScale }
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(() => readSavedPage(url, uid));
  const [scale, setScale] = useState(1.2);
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [downloading, setDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const [bytesDone, setBytesDone] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [speedBps, setSpeedBps] = useState(0);
  const downloadStartRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    loadPdfjs()
      .then((lib) => lib.getDocument({ url, ...PDF_DOC_OPTIONS }).promise)
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
    if (numPages) {
      savePdfProgress(url, uid, pageNum, numPages);
      syncPdfProgressToCloud(url, user, pageNum, numPages, title);
    }
    return () => {
      cancelled = true;
    };
  }, [status, pageNum, scale, url, uid, numPages, user, title]);

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

  function touchDistance(touches) {
    const [a, b] = touches;
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }

  // Two-finger pinch — live CSS scale on the canvas while pinching (cheap,
  // instant), then commit to a real re-rendered page at the final zoom
  // level on release so it stays sharp.
  function handleTouchStart(e) {
    if (e.touches.length !== 2) return;
    pinchRef.current = { startDist: touchDistance(e.touches), startScale: scale, lastFactor: 1 };
  }
  function handleTouchMove(e) {
    if (e.touches.length !== 2 || !pinchRef.current) return;
    e.preventDefault();
    const factor = touchDistance(e.touches) / pinchRef.current.startDist;
    pinchRef.current.lastFactor = factor;
    if (canvasRef.current) {
      canvasRef.current.style.transform = `scale(${factor})`;
    }
  }
  function handleTouchEnd(e) {
    if (!pinchRef.current || e.touches.length > 0) return;
    if (canvasRef.current) canvasRef.current.style.transform = "";
    const next = Math.min(
      MAX_SCALE,
      Math.max(MIN_SCALE, +(pinchRef.current.startScale * pinchRef.current.lastFactor).toFixed(2))
    );
    setScale(next);
    pinchRef.current = null;
  }

  // Downloads in-place — no navigating away or opening a new tab. Progress
  // shows in an overlay, and once the file is actually saved to the
  // device's Downloads folder we surface a success message (and, inside
  // the Android app wrapper, offer to jump straight to the downloads
  // screen if that bridge is available).
  async function handleDownload() {
    if (downloading) return;
    setDownloading(true);
    setDownloadDone(false);
    setBytesDone(0);
    setTotalBytes(0);
    setSpeedBps(0);
    downloadStartRef.current = Date.now();
    try {
      const res = await fetch(url);
      const size = Number(res.headers.get("content-length")) || 0;
      setTotalBytes(size);

      let blob;
      if (!res.body?.getReader) {
        blob = await res.blob();
      } else {
        const reader = res.body.getReader();
        const chunks = [];
        let received = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          setBytesDone(received);
          const elapsed = (Date.now() - downloadStartRef.current) / 1000;
          if (elapsed > 0) setSpeedBps(received / elapsed);
        }
        blob = new Blob(chunks, { type: res.headers.get("content-type") || "application/pdf" });
      }

      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileNameFromUrl(url, title);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
      setDownloadDone(true);
    } catch {
      window.alert("تعذّر تنزيل الملف — تحقّق من اتصال الإنترنت وحاول مجددًا");
    } finally {
      setDownloading(false);
    }
  }

  function openDownloadsFolder() {
    if (window.AndroidApp?.openDownloadsFolder) {
      window.AndroidApp.openDownloadsFolder();
    }
    setDownloadDone(false);
  }

  const downloadPercent = totalBytes > 0 ? Math.min(100, Math.round((bytesDone / totalBytes) * 100)) : 0;
  const downloadEtaSeconds =
    speedBps > 0 && totalBytes > 0 ? Math.max(0, (totalBytes - bytesDone) / speedBps) : null;

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
          <button
            type="button"
            className="pdf-viewer-icon-btn"
            onClick={handleDownload}
            disabled={downloading}
            title="تنزيل الملف"
            aria-label="تنزيل الملف"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
            </svg>
          </button>
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
          <div
            className="pdf-viewer-page-wrap"
            ref={pageWrapRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
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

      {downloading && (
        <div className="modal-overlay">
          <div className="modal-card curriculum-pdf-download-modal">
            <div className="download-all-header">
              <span>جارٍ تنزيل الملف</span>
            </div>
            <div className="download-all-progress">
              <div className="download-all-bar-row">
                <div className="leaderboard-bar download-all-bar">
                  <div className="leaderboard-bar-fill" style={{ width: `${downloadPercent}%` }} />
                </div>
                <span className="download-all-percent">{downloadPercent}%</span>
              </div>
              <div className="download-all-stats" dir="rtl">
                <span>
                  الوقت المتبقي تقريبًا: <strong>{formatEta(downloadEtaSeconds)}</strong>
                </span>
                <span className="download-all-stats-sep">·</span>
                <span>
                  {formatBytes(bytesDone)} من {totalBytes ? formatBytes(totalBytes) : "؟"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {downloadDone && (
        <div className="modal-overlay" onClick={() => setDownloadDone(false)}>
          <div className="modal-card pdf-download-done-modal" onClick={(e) => e.stopPropagation()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="pdf-download-done-icon">
              <path d="M20 6 9 17l-5-5" />
            </svg>
            <p>تم التنزيل بنجاح</p>
            {window.AndroidApp?.openDownloadsFolder ? (
              <button type="button" onClick={openDownloadsFolder}>
                فتح مجلد التنزيلات
              </button>
            ) : (
              <button type="button" onClick={() => setDownloadDone(false)}>
                حسنًا
              </button>
            )}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
