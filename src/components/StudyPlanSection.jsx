import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { collection, deleteDoc, doc, onSnapshot, query, setDoc, where } from "firebase/firestore";
import { db } from "../firebase";
import {
  STUDY_PLAN_CREDIT_NAME,
  STUDY_PLAN_CREDIT_ROLE,
  STUDY_PLAN_DEVELOPER_LABEL,
  STUDY_PLAN_DEVELOPER_NAME,
  STUDY_PLAN_DEVELOPER_ROLE,
} from "../data/studyPlan";
import SelectPickerModal from "./SelectPickerModal";
import { noteLines, useCurriculumPlan } from "../data/curriculum";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";

const CURRICULUM_PDF_DOC = doc(db, "curriculumMeta", "studyPlanPdf");

function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_").trim();
}

function composedFileName(book, sheikhLabel, lessonTitle, url) {
  const parts = [book.title, book.author, sheikhLabel, lessonTitle].filter(Boolean);
  // Keep the real extension — lessons are not always mp3 (archive.org items are
  // often m4a), and saving one under a wrong extension breaks some players.
  const ext = String(url || "").match(/\.(mp3|m4a|mp4|ogg|oga|opus|flac|wav|aac)(?:\?|$)/i);
  return sanitizeFileName(parts.join(" - ")) + (ext ? `.${ext[1].toLowerCase()}` : ".mp3");
}

function formatEta(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return "…";
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} ثانية`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m < 60) return s ? `${m} د ${s} ث` : `${m} دقيقة`;
  return `${Math.floor(m / 60)} س ${m % 60} د`;
}

function formatSpeed(bytesPerSecond) {
  if (!bytesPerSecond) return "";
  if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(0)} KB/s`;
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "—";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function saveBlob(blob, fileName) {
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

// `onChunk` reports bytes as they arrive so the caller can show real progress
// and estimate the remaining time from the measured speed.
async function fetchAndSave(url, fileName, onChunk) {
  const res = await fetch(url);
  const size = Number(res.headers.get("content-length")) || 0;

  if (!onChunk || !res.body?.getReader) {
    const blob = await res.blob();
    saveBlob(blob, fileName);
    return size || blob.size;
  }

  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onChunk(value.length);
  }
  const blob = new Blob(chunks, { type: res.headers.get("content-type") || "audio/mpeg" });
  saveBlob(blob, fileName);
  return size || received;
}

// archive.org serves direct, CORS-friendly file links that play fine inside
// an <audio> tag. Other hosts (MediaFire, Google Drive, ...) only give a
// landing/share page — there's no way to stream those in-app, so for those
// we just hand the user a download link and let them listen locally instead.
function isStreamableAudioUrl(url) {
  try {
    return new URL(url).hostname.toLowerCase().includes("archive.org");
  } catch {
    return false;
  }
}

// Accepts youtube.com/watch?v=, youtu.be/, and youtube.com/embed/ links.
function getYoutubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const embedMatch = u.pathname.match(/^\/(embed|shorts)\/([^/?#]+)/);
      if (embedMatch) return embedMatch[2];
    }
    return null;
  } catch {
    return null;
  }
}

function YoutubeEmbed({ videoId, label }) {
  return (
    <div className="study-plan-audio study-plan-youtube">
      {label && <p className="study-plan-youtube-label">{label}</p>}
      <div className="study-plan-youtube-frame">
        <iframe
          src={`https://www.youtube.com/embed/${videoId}`}
          title={label || "درس يوتيوب"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </div>
  );
}

function DownloadOnlyAudioCard({ url, label, book, sheikhLabel }) {
  const fileName = composedFileName(book, sheikhLabel, label, url);
  return (
    <div className="study-plan-audio study-plan-audio-external">
      <p className="study-plan-audio-external-note">
        هذا الدرس مستضاف على موقع خارجي — اضغط للتنزيل، ثم استمع إليه من مشغّل الصوتيات في جهازك.
      </p>
      <a
        className="study-plan-audio-external-btn"
        href={url}
        target="_blank"
        rel="noreferrer"
        download={fileName}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
        </svg>
        تنزيل {label ? `— ${label}` : ""}
      </a>
    </div>
  );
}

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds) || !Number.isFinite(seconds)) return "٠:٠٠";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function PlayerBar({ isPlaying, currentTime, duration, onOpen }) {
  const seekPercent = duration ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <button type="button" className="study-plan-audio-bar" dir="ltr" onClick={onOpen}>
      <span className="study-plan-audio-bar-playbtn" aria-hidden="true">
        {isPlaying ? (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </span>

      <span className="study-plan-audio-bar-time">{formatTime(currentTime)}</span>

      <span className="study-plan-audio-bar-seek">
        <span className="study-plan-audio-bar-seekfill" style={{ width: `${seekPercent}%` }} />
        <span className="study-plan-audio-bar-seekthumb" style={{ insetInlineStart: `${seekPercent}%` }} />
      </span>

      <span className="study-plan-audio-bar-time">{formatTime(duration)}</span>

      <span className="study-plan-audio-bar-expand" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </span>
    </button>
  );
}

function SeekTrack({ percent, onScrub, className = "" }) {
  const trackRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  function ratioFromEvent(e) {
    const rect = trackRef.current.getBoundingClientRect();
    const x = e.clientX;
    return Math.min(1, Math.max(0, (x - rect.left) / rect.width));
  }

  function handlePointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
    onScrub(ratioFromEvent(e));
  }

  function handlePointerMove(e) {
    if (!dragging) return;
    onScrub(ratioFromEvent(e));
  }

  function handlePointerUp(e) {
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }

  return (
    <div
      ref={trackRef}
      className={`seek-track ${className}${dragging ? " dragging" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      role="slider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
    >
      <div className="seek-track-fill" style={{ width: `${percent}%` }} />
      <div className="seek-track-thumb" style={{ insetInlineStart: `${percent}%` }} />
    </div>
  );
}

function AdvancedPlayer({
  title,
  subtitle,
  isPlaying,
  currentTime,
  duration,
  audioError,
  onTogglePlay,
  onScrub,
  onSkip,
  onRetry,
  onClose,
}) {
  const seekPercent = duration ? Math.min(100, (currentTime / duration) * 100) : 0;

  return createPortal(
    <div className="adv-player-screen" dir="ltr">
      <div className="adv-player-topbar">
        <button type="button" className="adv-player-collapse" onClick={onClose} aria-label="إغلاق المشغّل">
          <span className="adv-player-collapse-glyph" aria-hidden="true">✕</span>
        </button>
        <span className="adv-player-topbar-label">قيد التشغيل</span>
        <span className="adv-player-topbar-spacer" />
      </div>

      <div className="adv-player-art">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>

      <div className="adv-player-info">
        <div className="adv-player-info-text">
          <p className="adv-player-title">{title}</p>
          {subtitle && <p className="adv-player-subtitle">{subtitle}</p>}
        </div>
      </div>

      {audioError ? (
        <div className="adv-player-error">
          <p>تعذّر تحميل الصوت — تحقّق من اتصال الإنترنت</p>
          <button type="button" className="adv-player-retry" onClick={onRetry}>
            إعادة المحاولة
          </button>
        </div>
      ) : (
        <>
          <SeekTrack
            className="adv-player-seek"
            percent={seekPercent}
            onScrub={(ratio) => onScrub(ratio * duration)}
          />
          <div className="adv-player-times">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          <div className="adv-player-controls">
            <button type="button" className="adv-player-skip" onClick={() => onSkip(-10)} aria-label="رجوع 10 ثوانٍ">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M9 7 4 12l5 5" />
                <path d="M4 12h9a5 5 0 0 1 0 10h-1" />
              </svg>
              <span>10</span>
            </button>
            <button
              type="button"
              className="adv-player-playbtn"
              onClick={onTogglePlay}
              aria-label={isPlaying ? "إيقاف" : "تشغيل"}
            >
              {isPlaying ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="5" width="4" height="14" rx="1" />
                  <rect x="14" y="5" width="4" height="14" rx="1" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>
            <button type="button" className="adv-player-skip" onClick={() => onSkip(10)} aria-label="تقدّم 10 ثوانٍ">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="m15 7 5 5-5 5" />
                <path d="M20 12h-9a5 5 0 0 0 0 10h1" />
              </svg>
              <span>10</span>
            </button>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}

function AudioPlayer({ url, label, isAdmin, user, book, sheikhLabel }) {
  const [percent, setPercent] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const audioRef = useRef(null);
  const wrapperRef = useRef(null);
  const lastSentRef = useRef(0);
  const lastGoodTimeRef = useRef(0);
  const retryCountRef = useRef(0);
  const wasPlayingRef = useRef(false);

  function handleCloseAdvanced() {
    setShowAdvanced(false);
    wrapperRef.current?.scrollIntoView({ block: "center" });
  }

  function reportProgress(payload) {
    if (isAdmin || !user) return; // only track real students, not admin previews
    api
      .updateListeningProgress({
        studentId: user.uid,
        book: book.title,
        sheikh: label ? `${sheikhLabel} — ${label}` : sheikhLabel,
        ...payload,
      })
      .catch(() => {});
  }

  function handleTimeUpdate(e) {
    const { currentTime: t, duration: d } = e.target;
    setCurrentTime(t);
    lastGoodTimeRef.current = t;
    retryCountRef.current = 0;
    if (!d || Number.isNaN(d)) return;
    const pct = Math.round((t / d) * 100);
    setPercent(pct);
    if (pct - lastSentRef.current >= 5 || pct === 100) {
      lastSentRef.current = pct;
      reportProgress({ progressPercent: pct });
    }
    if ("mediaSession" in navigator) {
      try {
        navigator.mediaSession.setPositionState({ duration: d, playbackRate: e.target.playbackRate, position: t });
      } catch {
        /* unsupported state combo, ignore */
      }
    }
  }

  // Publishes track info + play/pause/seek controls to the OS-level media
  // notification and lock screen (Android "live notification" card).
  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: label || book.title,
      artist: sheikhLabel || book.author || "",
      album: book.title,
      artwork: [
        { src: `${import.meta.env.BASE_URL}logo.png`, sizes: "512x512", type: "image/png" },
      ],
    });
  }, [label, book.title, book.author, sheikhLabel]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused";
  }, [isPlaying]);

  useEffect(() => {
    if (!("mediaSession" in navigator)) return;
    const audio = audioRef.current;
    navigator.mediaSession.setActionHandler("play", () => audio?.play());
    navigator.mediaSession.setActionHandler("pause", () => audio?.pause());
    navigator.mediaSession.setActionHandler("seekbackward", (details) => {
      if (!audio) return;
      audio.currentTime = Math.max(0, audio.currentTime - (details.seekOffset || 10));
    });
    navigator.mediaSession.setActionHandler("seekforward", (details) => {
      if (!audio) return;
      audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + (details.seekOffset || 10));
    });
    navigator.mediaSession.setActionHandler("seekto", (details) => {
      if (!audio || details.seekTime == null) return;
      audio.currentTime = details.seekTime;
    });
    return () => {
      navigator.mediaSession.setActionHandler("play", null);
      navigator.mediaSession.setActionHandler("pause", null);
      navigator.mediaSession.setActionHandler("seekbackward", null);
      navigator.mediaSession.setActionHandler("seekforward", null);
      navigator.mediaSession.setActionHandler("seekto", null);
    };
  }, []);

  function handleTogglePlay() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  }

  function handleScrubTo(time) {
    if (!audioRef.current) return;
    wasPlayingRef.current = !audioRef.current.paused;
    lastGoodTimeRef.current = time;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  }

  function handleSkip(delta) {
    if (!audioRef.current || !duration) return;
    wasPlayingRef.current = !audioRef.current.paused;
    const next = Math.min(duration, Math.max(0, audioRef.current.currentTime + delta));
    lastGoodTimeRef.current = next;
    audioRef.current.currentTime = next;
    setCurrentTime(next);
  }

  function handleReplay() {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
    reportProgress({ progressPercent: percent, replay: true });
  }

  function handleStop() {
    if (!audioRef.current) return;
    audioRef.current.pause();
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
  }

  function handleOpenAdvanced() {
    setShowAdvanced(true);
    if (!audioError) audioRef.current?.play();
  }

  function reloadAndResume() {
    const audio = audioRef.current;
    if (!audio) return;
    const resumeAt = lastGoodTimeRef.current;
    const shouldPlay = wasPlayingRef.current;

    const onLoaded = () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.currentTime = resumeAt;
      if (shouldPlay) audio.play().catch(() => setAudioError(true));
    };
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.load();
  }

  function handleAudioError() {
    wasPlayingRef.current = isPlaying;
    // Archive.org occasionally drops a request mid-stream (especially right
    // after seeking); retry once silently before bothering the user.
    if (retryCountRef.current < 1) {
      retryCountRef.current += 1;
      reloadAndResume();
      return;
    }
    setAudioError(true);
  }

  function handleRetry() {
    setAudioError(false);
    retryCountRef.current = 0;
    wasPlayingRef.current = true;
    reloadAndResume();
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      await fetchAndSave(url, composedFileName(book, sheikhLabel, label, url));
      reportProgress({ progressPercent: percent, downloaded: true });
    } catch {
      window.open(url, "_blank", "noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="study-plan-audio" ref={wrapperRef}>
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onPlay={() => {
          setIsPlaying(true);
          wasPlayingRef.current = true;
        }}
        onPause={() => {
          setIsPlaying(false);
          wasPlayingRef.current = false;
        }}
        onEnded={() => {
          setIsPlaying(false);
          reportProgress({ progressPercent: 100 });
        }}
        onError={handleAudioError}
      >
        متصفحك لا يدعم تشغيل الصوت مباشرة — استخدم زر التنزيل بدلًا من ذلك.
      </audio>

      <PlayerBar
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onOpen={handleOpenAdvanced}
      />

      {showAdvanced && (
        <AdvancedPlayer
          title={label || book.title}
          subtitle={sheikhLabel}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          audioError={audioError}
          onTogglePlay={handleTogglePlay}
          onScrub={handleScrubTo}
          onSkip={handleSkip}
          onRetry={handleRetry}
          onClose={handleCloseAdvanced}
        />
      )}

      <div className="study-plan-audio-row">
        <button type="button" className="study-plan-audio-replay" onClick={handleReplay} aria-label="إعادة التشغيل" title="إعادة التشغيل">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 12a8 8 0 1 1 2.6 5.9" />
            <path d="M4 20v-5h5" />
          </svg>
        </button>
        <button type="button" className="study-plan-audio-stop" onClick={handleStop} aria-label="توقف" title="توقف">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="1.5" />
          </svg>
        </button>
        <button
          type="button"
          className="study-plan-audio-download"
          onClick={handleDownload}
          disabled={downloading}
          aria-label={downloading ? "جارٍ التنزيل..." : "تنزيل"}
          title={downloading ? "جارٍ التنزيل..." : "تنزيل"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
          </svg>
        </button>
      </div>

      {!isAdmin && percent > 0 && (
        <span className="study-plan-audio-percent">تم الاستماع: {percent}٪</span>
      )}
    </div>
  );
}

function NoPdfModal({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card no-pdf-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <p className="no-pdf-title">أهلًا وسهلًا أخي الكريم</p>
        <p className="no-pdf-text">لم يتم رفع أي ملف بعد، يرجى إخبار المعلم أو الشيخ</p>
      </div>
    </div>
  );
}

function DownloadsInfoModal({ onClose }) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card downloads-info-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        <p className="downloads-info-greeting">السلام عليكم أخي الكريم / أختي الكريمة</p>

        <p className="downloads-info-body">
          لو سمحت ادخل إلى <strong>التنزيلات</strong> — الملفات نزلت إلى هناك.
        </p>

        <p className="downloads-info-warning">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M12 9v5M12 17.5v.5" />
            <path d="M10.3 3.9 1.9 18.4A2 2 0 0 0 3.6 21.4h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
          </svg>
          يرجى جمع كل الدروس في مجلد واحد حتى لا تختلط مع الكتب الأخرى
        </p>

        <button type="button" className="downloads-info-ok" onClick={onClose}>
          حسنًا
        </button>
      </div>
    </div>,
    document.body
  );
}

function DownloadAllPanel({ entry, book, sheikhLabel, downloadedSet, onClose, onFileDownloaded }) {
  const [sizes, setSizes] = useState({}); // idx -> bytes | null (loading) | undefined (unknown)
  const [status, setStatus] = useState({}); // idx -> "queued" | "downloading" | "done" | "error"
  const [running, setRunning] = useState(false);
  const [justFinished, setJustFinished] = useState(false);
  const [showDownloadsInfo, setShowDownloadsInfo] = useState(false);
  const [bytesDone, setBytesDone] = useState(0);
  const [runTotalBytes, setRunTotalBytes] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startedAtRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled(
      entry.map((lesson) =>
        fetch(lesson.url, { method: "HEAD" }).then((res) =>
          Number(res.headers.get("content-length")) || null
        )
      )
    ).then((results) => {
      if (cancelled) return;
      const next = {};
      results.forEach((r, i) => {
        next[i] = r.status === "fulfilled" ? r.value : null;
      });
      setSizes(next);
    });
    return () => {
      cancelled = true;
    };
  }, [entry]);

  function isDone(i) {
    return status[i] === "done" || downloadedSet.has(`${sheikhLabel} — ${entry[i].title}`);
  }

  const totalKnownBytes = Object.values(sizes).reduce((sum, v) => sum + (v || 0), 0);
  const doneCount = entry.filter((_, i) => isDone(i)).length;
  const remainingIdx = entry.map((_, i) => i).filter((i) => !isDone(i));

  // Tick while downloading so the speed/ETA readout stays live.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((Date.now() - startedAtRef.current) / 1000), 500);
    return () => clearInterval(id);
  }, [running]);

  // Prefer real byte progress; fall back to file counts if sizes are unknown.
  const percent = runTotalBytes
    ? Math.min(100, Math.round((bytesDone / runTotalBytes) * 100))
    : Math.round((doneCount / entry.length) * 100);
  const speedBps = elapsed > 0.5 ? bytesDone / elapsed : 0;
  const etaSeconds =
    speedBps > 0 && runTotalBytes > bytesDone ? (runTotalBytes - bytesDone) / speedBps : null;

  async function startAll() {
    const plannedBytes = remainingIdx.reduce((sum, i) => sum + (sizes[i] || 0), 0);
    setRunTotalBytes(plannedBytes);
    setBytesDone(0);
    setElapsed(0);
    startedAtRef.current = Date.now();
    setRunning(true);

    let anySaved = false;
    for (const i of remainingIdx) {
      setStatus((s) => ({ ...s, [i]: "downloading" }));
      try {
        await fetchAndSave(
          entry[i].url,
          composedFileName(book, sheikhLabel, entry[i].title, entry[i].url),
          (chunkBytes) => setBytesDone((b) => b + chunkBytes)
        );
        setStatus((s) => ({ ...s, [i]: "done" }));
        onFileDownloaded(entry[i].title);
        anySaved = true;
      } catch {
        setStatus((s) => ({ ...s, [i]: "error" }));
      }
    }
    setRunning(false);
    if (anySaved) setJustFinished(true);
  }

  // Inside our Android app, MainActivity injects window.AndroidApp — use it to
  // open the device's real Downloads screen directly. Everywhere else (plain
  // browser) that bridge doesn't exist, so fall back to the in-app dialog
  // instead of a native alert() (which would print the site's URL).
  function openDownloads() {
    if (window.AndroidApp?.openDownloadsFolder) {
      window.AndroidApp.openDownloadsFolder();
      return;
    }
    setShowDownloadsInfo(true);
  }

  return (
    <div className="download-all-panel">
      <div className="download-all-header">
        <span>تنزيل كل الدروس ({entry.length})</span>
        <button type="button" className="modal-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <ul className="download-all-list">
        {entry.map((lesson, i) => {
          const st =
            status[i] === "downloading"
              ? "downloading"
              : isDone(i)
                ? "done"
                : status[i] === "error"
                  ? "error"
                  : "queued";
          return (
            <li key={i} className="download-all-item">
              <span className="download-all-item-title">{lesson.title}</span>
              <span className="download-all-item-size">{formatBytes(sizes[i])}</span>
              <span className={`download-all-item-status status-${st}`}>
                {st === "done" ? "✓" : st === "downloading" ? "..." : st === "error" ? "✕" : ""}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="download-all-footer">
        <span>الحجم الإجمالي: {formatBytes(totalKnownBytes)}</span>
        {running && (
          <div className="download-all-progress">
            <div className="download-all-bar-row">
              <div className="leaderboard-bar download-all-bar">
                <div className="leaderboard-bar-fill" style={{ width: `${percent}%` }} />
              </div>
              <span className="download-all-percent">{percent}%</span>
            </div>
            <div className="download-all-stats" dir="rtl">
              <span>
                الوقت المتبقي تقريبًا: <strong>{formatEta(etaSeconds)}</strong>
              </span>
              <span className="download-all-stats-sep">·</span>
              <span>
                {formatBytes(bytesDone)} من {formatBytes(runTotalBytes)}
              </span>
              {speedBps > 0 && (
                <>
                  <span className="download-all-stats-sep">·</span>
                  <span dir="ltr">{formatSpeed(speedBps)}</span>
                </>
              )}
            </div>
          </div>
        )}
        <button type="button" onClick={startAll} disabled={running || remainingIdx.length === 0}>
          {running
            ? `جارٍ التنزيل... (${doneCount}/${entry.length})`
            : remainingIdx.length === 0
              ? "تم تنزيل كل الدروس"
              : `بدء تنزيل الكل (${remainingIdx.length} متبقّي)`}
        </button>

        {running && (
          <p className="download-all-warning" role="alert">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M12 9v5M12 17.5v.5" />
              <path d="M10.3 3.9 1.9 18.4A2 2 0 0 0 3.6 21.4h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
            </svg>
            لا تغلق الصفحة حتى تنتهي كل التنزيلات
          </p>
        )}

        {!running && justFinished && (
          <div className="download-all-done">
            <p className="download-all-done-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              اكتمل التنزيل — الملفات محفوظة في جهازك
            </p>
            <p className="download-all-done-path">
              مجلّد التنزيلات: <span dir="ltr">Downloads</span>
            </p>
            <button type="button" className="download-all-open" onClick={openDownloads}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M3 7h5l2 2h11v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7Z" />
              </svg>
              فتح مجلّد التنزيلات
            </button>
          </div>
        )}
      </div>

      {showDownloadsInfo && <DownloadsInfoModal onClose={() => setShowDownloadsInfo(false)} />}
    </div>
  );
}

function LessonPickerModal({ entry, sheikhLabel, downloadedSet, staticCount, onSelect, onDelete, onClose }) {
  const { isSuperadmin } = useAuth();

  // Show YouTube lessons first — original index (li) rides along for the
  // select/delete callbacks, which are keyed to the underlying storage order,
  // not whatever order they're displayed in here.
  const ordered = entry
    .map((l, li) => ({ l, li }))
    .sort((a, b) => {
      const aYt = getYoutubeId(a.l.url) ? 0 : 1;
      const bYt = getYoutubeId(b.l.url) ? 0 : 1;
      return aYt - bYt || a.li - b.li;
    });

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card lesson-picker-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <p className="lesson-picker-title">اختر الدرس</p>
        <div className="lesson-picker-grid">
          {ordered.map(({ l, li }) => {
            const done = downloadedSet.has(`${sheikhLabel} — ${l.title}`);
            const isDeletable = isSuperadmin && li >= staticCount;
            const isYoutube = !!getYoutubeId(l.url);
            return (
              <div key={li} className={`lesson-picker-item${done ? " done" : ""}${isDeletable ? " deletable" : ""}`}>
                <button type="button" className="lesson-picker-item-btn" onClick={() => onSelect(li)}>
                  {isYoutube && (
                    <svg viewBox="0 0 24 24" fill="currentColor" className="lesson-picker-item-youtube">
                      <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 5 12 5 12 5s-6 0-7.7.3a2.7 2.7 0 0 0-1.9 1.9A28 28 0 0 0 2 12a28 28 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9C6 19 12 19 12 19s6 0 7.7-.3a2.7 2.7 0 0 0 1.9-1.9A28 28 0 0 0 22 12a28 28 0 0 0-.4-4.8ZM10 15V9l5 3-5 3Z" />
                    </svg>
                  )}
                  {l.title}
                  {done && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
                {isDeletable && (
                  <button
                    type="button"
                    className="lesson-picker-item-delete"
                    onClick={() => onDelete(li - staticCount)}
                    aria-label="حذف الدرس"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

function PdfPickerModal({ pdfs, onClose }) {
  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card lesson-picker-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <p className="lesson-picker-title">اختر الملف</p>
        <div className="pdf-picker-list">
          {pdfs.map((p, i) => (
            <a
              key={i}
              className="pdf-picker-item"
              href={p.url}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 3v4a1 1 0 0 0 1 1h4" />
                <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
              </svg>
              {p.title || `ملف ${i + 1}`}
            </a>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

function PdfManagerModal({ bookTitle, pdfs, onAdd, onRemove, onClose }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const t = title.trim();
    const u = url.trim();
    if (!t || !u) return;
    setSaving(true);
    try {
      await onAdd(t, u);
      setTitle("");
      setUrl("");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card pdf-manager-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
        <p className="lesson-picker-title">ملفات PDF — {bookTitle}</p>

        {pdfs.length > 0 && (
          <ul className="curriculum-settings-list">
            {pdfs.map((p, i) => (
              <li key={i}>
                <span className="curriculum-settings-lesson-title">{p.title}</span>
                <button
                  type="button"
                  className="curriculum-settings-remove"
                  onClick={() => onRemove(i)}
                  aria-label="حذف الملف"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="curriculum-settings-add">
          <input
            type="text"
            placeholder="اسم الملف (مثلًا: المتن، أو شرح ابن عثيمين)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            type="url"
            placeholder="رابط ملف PDF"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button type="button" onClick={submit} disabled={saving || !title.trim() || !url.trim()}>
            {saving ? "جارٍ الحفظ..." : "إضافة الملف"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function BookCard({ book, order, onSaveEdit, onDeleteBook, trackingButton }) {
  const { user, isAdmin, isSuperadmin } = useAuth();
  const [editing, setEditing] = useState(false);
  const [editAuthor, setEditAuthor] = useState(book.author || "");
  const [editNote, setEditNote] = useState(book.note || "");
  const [editOrder, setEditOrder] = useState(String(order));
  const lines = book.note ? noteLines(book.note) : [];
  const [selected, setSelected] = useState("");
  const [lessonIdx, setLessonIdx] = useState("");
  const [showNoPdf, setShowNoPdf] = useState(false);
  const [showDownloadAll, setShowDownloadAll] = useState(false);
  const [showLessonPicker, setShowLessonPicker] = useState(false);
  const [downloadedSet, setDownloadedSet] = useState(new Set());
  const [extraBySheikh, setExtraBySheikh] = useState({});
  const [dynamicPdfUrl, setDynamicPdfUrl] = useState(null);
  const [pdfList, setPdfList] = useState([]);
  const [showPdfPicker, setShowPdfPicker] = useState(false);
  const [showPdfManager, setShowPdfManager] = useState(false);
  const [showSheikhPicker, setShowSheikhPicker] = useState(false);
  const sheikhAutoPickedRef = useRef(false);

  const idx = selected === "" ? null : Number(selected);
  const staticEntry = idx !== null ? book.audio?.[idx] : null;
  const sheikhLabel = idx !== null ? lines[idx] : null;
  const extraLessons = sheikhLabel ? extraBySheikh[sheikhLabel] : null;
  const isLessonSeries = Array.isArray(staticEntry) || !!extraLessons?.length;
  const entry = isLessonSeries
    ? [...(Array.isArray(staticEntry) ? staticEntry : []), ...(extraLessons || [])]
    : staticEntry;
  const singleUrl = !isLessonSeries ? staticEntry : null;
  const lesson = isLessonSeries && lessonIdx !== "" ? entry[Number(lessonIdx)] : null;
  // Books can carry several PDFs (the matn, a commentary, ...). Older data had
  // a single `pdfUrl`, so fold that into the list for backwards compatibility.
  const allPdfs = [
    ...(dynamicPdfUrl ? [{ title: "الكتاب", url: dynamicPdfUrl }] : []),
    ...(!dynamicPdfUrl && book.pdfUrl ? [{ title: "الكتاب", url: book.pdfUrl }] : []),
    ...pdfList,
  ];
  const hasLessons = Object.values(extraBySheikh).some((arr) => arr?.length > 0);
  const hasDynamicData = !!dynamicPdfUrl || pdfList.length > 0 || hasLessons;

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "curriculumAudio", book.title), (snap) => {
      const data = snap.data();
      const nextBySheikh = data?.bySheikh || {};
      setExtraBySheikh(nextBySheikh);
      setDynamicPdfUrl(data?.pdfUrl || null);
      setPdfList(Array.isArray(data?.pdfs) ? data.pdfs : []);

      // Open the card straight on a sheikh's lessons by default — prefer
      // whichever sheikh actually has lessons saved (static or dynamic) over
      // just always defaulting to the first one listed in the note.
      if (!sheikhAutoPickedRef.current && lines.length > 0) {
        const withData = lines.findIndex((label, i) => {
          const staticHas = Array.isArray(book.audio?.[i])
            ? book.audio[i].length > 0
            : !!book.audio?.[i];
          return staticHas || (nextBySheikh[label] || []).length > 0;
        });
        setSelected(String(withData >= 0 ? withData : 0));
        sheikhAutoPickedRef.current = true;
      }
    });
    return unsub;
  }, [book.title]);

  useEffect(() => {
    if (!user || isAdmin) return;
    const unsub = onSnapshot(
      query(
        collection(db, "listeningProgress"),
        where("studentId", "==", user.uid),
        where("book", "==", book.title)
      ),
      (snap) => {
        const set = new Set();
        snap.docs.forEach((d) => {
          const data = d.data();
          if (data.downloaded) set.add(data.sheikh);
        });
        setDownloadedSet(set);
      }
    );
    return unsub;
  }, [user, isAdmin, book.title]);

  function handlePdfClick() {
    if (allPdfs.length > 1) {
      setShowPdfPicker(true);
    } else if (allPdfs.length === 1) {
      window.open(allPdfs[0].url, "_blank", "noreferrer");
    } else {
      setShowNoPdf(true);
    }
  }

  async function handleDeleteLesson(extraIdx) {
    if (!sheikhLabel || !window.confirm("هل تريد حذف هذا الدرس؟")) return;
    const nextExtra = (extraLessons || []).filter((_, i) => i !== extraIdx);
    try {
      await setDoc(
        doc(db, "curriculumAudio", book.title),
        { bySheikh: { ...extraBySheikh, [sheikhLabel]: nextExtra } },
        { merge: true }
      );
      setLessonIdx("");
    } catch {
      window.alert("تعذّر حذف الدرس — تحقّق من اتصال الإنترنت وحاول مجددًا");
    }
  }

  async function handleResetInfo() {
    if (
      !window.confirm(
        `هل تريد تصفير كل المعلومات المضافة لكتاب "${book.title}" (كل الدروس الصوتية وملف PDF)؟ لا يمكن التراجع.`
      )
    )
      return;
    try {
      await deleteDoc(doc(db, "curriculumAudio", book.title));
      setSelected("");
      setLessonIdx("");
    } catch {
      window.alert("تعذّر التصفير — تحقّق من اتصال الإنترنت وحاول مجددًا");
    }
  }

  async function savePdfs(nextPdfs) {
    try {
      await setDoc(doc(db, "curriculumAudio", book.title), { pdfs: nextPdfs }, { merge: true });
    } catch {
      window.alert("تعذّر الحفظ — تحقّق من اتصال الإنترنت وحاول مجددًا");
    }
  }

  function handleAddPdf(title, url) {
    return savePdfs([...pdfList, { title, url }]);
  }

  function handleRemovePdf(i) {
    if (!window.confirm("هل تريد حذف هذا الملف؟")) return;
    savePdfs(pdfList.filter((_, li) => li !== i));
  }

  function handleSaveEdit() {
    const n = Number(editOrder);
    onSaveEdit(book.title, {
      author: editAuthor.trim(),
      note: editNote.trim(),
      order: Number.isFinite(n) && n > 0 ? n : order,
    });
    setEditing(false);
  }

  function handleDelete() {
    if (!window.confirm(`هل تريد حذف كتاب "${book.title}" من المنهج؟`)) return;
    onDeleteBook(book.title);
  }

  function handleFileDownloaded(lessonTitle) {
    if (isAdmin || !user) return;
    api
      .updateListeningProgress({
        studentId: user.uid,
        book: book.title,
        sheikh: `${sheikhLabel} — ${lessonTitle}`,
        progressPercent: 0,
        downloaded: true,
      })
      .catch(() => {});
  }

  return (
    <li className={`study-plan-book${hasLessons ? " study-plan-book-filled" : ""}`}>
      {isSuperadmin && (
        <button
          type="button"
          className="study-plan-book-reset"
          onClick={handleResetInfo}
          disabled={!hasDynamicData}
          aria-label="تصفير معلومات الكتاب"
          title={
            hasDynamicData
              ? "تصفير كل الدروس وملفات PDF المضافة لهذا الكتاب"
              : "لا توجد معلومات مضافة لتصفيرها — دروس هذا الكتاب مدمجة في التطبيق"
          }
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 12a8 8 0 1 1 2.6 5.9" />
            <path d="M4 20v-5h5" />
          </svg>
        </button>
      )}
      {isSuperadmin && (
        <div className="study-plan-book-manage">
          <button
            type="button"
            className="study-plan-book-manage-btn"
            onClick={() => {
              setEditAuthor(book.author || "");
              setEditNote(book.note || "");
              setEditOrder(String(order));
              setEditing((v) => !v);
            }}
            aria-label="تعديل بيانات الكتاب"
            title="تعديل الترقيم/المؤلف/الشرح"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
          <button
            type="button"
            className="study-plan-book-manage-btn delete"
            onClick={handleDelete}
            aria-label="حذف الكتاب"
            title="حذف الكتاب من المنهج"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" />
            </svg>
          </button>
        </div>
      )}
      <span className="study-plan-book-order">{order}</span>
      <span className="study-plan-book-title">{book.title}</span>
      {book.author && (
        <span className="study-plan-book-author">{book.author}</span>
      )}

      {editing && (
        <div className="study-plan-book-edit">
          <label className="study-plan-book-edit-order">
            <span>الترقيم</span>
            <input
              type="number"
              min="1"
              value={editOrder}
              onChange={(e) => setEditOrder(e.target.value)}
            />
          </label>
          <input
            type="text"
            placeholder="المؤلف"
            value={editAuthor}
            onChange={(e) => setEditAuthor(e.target.value)}
          />
          <input
            type="text"
            placeholder="الشرح (مثلًا: شرح فلان ثم شرح علّان)"
            value={editNote}
            onChange={(e) => setEditNote(e.target.value)}
          />
          <p className="study-plan-book-edit-hint">
            الترقيم يحدد ترتيب ظهور الكتاب داخل هذا الباب — لو اخترت رقمًا مأخوذًا، يُدرج الكتاب في ذلك المكان وتتحرك بقية الكتب تلقائيًا.
          </p>
          <div className="study-plan-book-edit-actions">
            <button type="button" onClick={handleSaveEdit}>
              حفظ
            </button>
            <button type="button" className="cancel" onClick={() => setEditing(false)}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      <div className="study-plan-book-actions-row">
        {lines.length > 0 ? (
          <button
            type="button"
            className="study-plan-book-select"
            onClick={() => setShowSheikhPicker(true)}
          >
            {selected !== "" ? lines[Number(selected)] : "شرح بالصوت"}
          </button>
        ) : (
          <span className="study-plan-book-select study-plan-book-select-disabled">
            شرح بالصوت
          </span>
        )}

        <button type="button" className="study-plan-book-select study-plan-pdf-btn" onClick={handlePdfClick}>
          كتاب PDF
          {allPdfs.length > 1 && <span className="study-plan-pdf-count">{allPdfs.length}</span>}
        </button>
      </div>

      {isSuperadmin && (
        <button
          type="button"
          className="study-plan-book-select study-plan-pdf-manage-btn"
          onClick={() => setShowPdfManager(true)}
        >
          إدارة ملفات PDF
        </button>
      )}

      {trackingButton}

      {idx !== null && isLessonSeries && (
        <>
          <button
            type="button"
            className="study-plan-book-select"
            onClick={() => setShowLessonPicker(true)}
          >
            {(lessonIdx !== "" ? getYoutubeId(entry[Number(lessonIdx)]?.url) : entry.some((l) => getYoutubeId(l.url))) && (
              <svg viewBox="0 0 24 24" fill="currentColor" className="lesson-picker-item-youtube">
                <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 5 12 5 12 5s-6 0-7.7.3a2.7 2.7 0 0 0-1.9 1.9A28 28 0 0 0 2 12a28 28 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9C6 19 12 19 12 19s6 0 7.7-.3a2.7 2.7 0 0 0 1.9-1.9A28 28 0 0 0 22 12a28 28 0 0 0-.4-4.8ZM10 15V9l5 3-5 3Z" />
              </svg>
            )}
            {lessonIdx !== "" ? entry[Number(lessonIdx)].title : "انقر لرؤية الدروس"}
          </button>

          <button
            type="button"
            className="study-plan-book-select study-plan-download-all-btn"
            onClick={() => setShowDownloadAll(true)}
          >
            تنزيل كل الدروس
          </button>

          {showLessonPicker && (
            <LessonPickerModal
              entry={entry}
              sheikhLabel={sheikhLabel}
              downloadedSet={downloadedSet}
              staticCount={Array.isArray(staticEntry) ? staticEntry.length : 0}
              onSelect={(li) => {
                setLessonIdx(String(li));
                setShowLessonPicker(false);
              }}
              onDelete={handleDeleteLesson}
              onClose={() => setShowLessonPicker(false)}
            />
          )}
        </>
      )}

      {idx !== null && (
        <>
          {isLessonSeries ? (
            lesson ? (
              getYoutubeId(lesson.url) ? (
                <YoutubeEmbed
                  key={lesson.url}
                  videoId={getYoutubeId(lesson.url)}
                  label={lesson.title}
                />
              ) : isStreamableAudioUrl(lesson.url) ? (
                <AudioPlayer
                  key={lesson.url}
                  url={lesson.url}
                  label={lesson.title}
                  isAdmin={isAdmin}
                  user={user}
                  book={book}
                  sheikhLabel={sheikhLabel}
                />
              ) : (
                <DownloadOnlyAudioCard
                  key={lesson.url}
                  url={lesson.url}
                  label={lesson.title}
                  book={book}
                  sheikhLabel={sheikhLabel}
                />
              )
            ) : (
              <span className="study-plan-audio-missing">اختر الدرس لتشغيله</span>
            )
          ) : singleUrl ? (
            getYoutubeId(singleUrl) ? (
              <YoutubeEmbed key={singleUrl} videoId={getYoutubeId(singleUrl)} label={null} />
            ) : isStreamableAudioUrl(singleUrl) ? (
              <AudioPlayer
                key={singleUrl}
                url={singleUrl}
                label={null}
                isAdmin={isAdmin}
                user={user}
                book={book}
                sheikhLabel={sheikhLabel}
              />
            ) : (
              <DownloadOnlyAudioCard key={singleUrl} url={singleUrl} label={null} book={book} sheikhLabel={sheikhLabel} />
            )
          ) : (
            <span className="study-plan-audio-missing">الصوت غير متوفر بعد</span>
          )}
        </>
      )}

      {showSheikhPicker && (
        <SelectPickerModal
          title="شرح بالصوت"
          options={lines.map((line, li) => ({ value: String(li), label: line }))}
          selectedValue={selected}
          onSelect={(v) => {
            sheikhAutoPickedRef.current = true;
            setSelected(v);
            setLessonIdx("");
          }}
          onClose={() => setShowSheikhPicker(false)}
        />
      )}

      {showNoPdf && <NoPdfModal onClose={() => setShowNoPdf(false)} />}

      {showPdfPicker && <PdfPickerModal pdfs={allPdfs} onClose={() => setShowPdfPicker(false)} />}

      {showPdfManager && (
        <PdfManagerModal
          bookTitle={book.title}
          pdfs={pdfList}
          onAdd={handleAddPdf}
          onRemove={handleRemovePdf}
          onClose={() => setShowPdfManager(false)}
        />
      )}

      {showDownloadAll &&
        isLessonSeries &&
        createPortal(
          <div className="download-all-fullscreen">
            <DownloadAllPanel
              entry={entry}
              book={book}
              sheikhLabel={sheikhLabel}
              downloadedSet={downloadedSet}
              onClose={() => setShowDownloadAll(false)}
              onFileDownloaded={handleFileDownloaded}
            />
          </div>,
          document.body
        )}
    </li>
  );
}

function CurriculumPdfPanel() {
  const { isSuperadmin } = useAuth();
  const [fileUrl, setFileUrl] = useState(undefined); // undefined = loading, null = missing
  const [editing, setEditing] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [bytesDone, setBytesDone] = useState(0);
  const [totalBytes, setTotalBytes] = useState(0);
  const [speedBps, setSpeedBps] = useState(0);
  const startedAtRef = useRef(0);

  useEffect(() => {
    const unsub = onSnapshot(CURRICULUM_PDF_DOC, (snap) => {
      const url = snap.data()?.url || null;
      setFileUrl(url);
      setUrlInput(url || "");
    });
    return unsub;
  }, []);

  async function handleSave() {
    const url = urlInput.trim();
    if (!url) return;
    setSaving(true);
    try {
      await setDoc(CURRICULUM_PDF_DOC, { url }, { merge: true });
      setEditing(false);
    } catch {
      window.alert("تعذّر حفظ الرابط — تحقّق من اتصال الإنترنت وحاول مجددًا");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("هل تريد حذف رابط ملف خطة الدراسة؟")) return;
    setDeleting(true);
    try {
      await setDoc(CURRICULUM_PDF_DOC, { url: null }, { merge: true });
    } catch {
      window.alert("تعذّر حذف الرابط — حاول مجددًا");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDownload() {
    if (!fileUrl || downloading) return;
    setDownloading(true);
    setBytesDone(0);
    setTotalBytes(0);
    setSpeedBps(0);
    startedAtRef.current = Date.now();
    try {
      const res = await fetch(fileUrl);
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
          const elapsed = (Date.now() - startedAtRef.current) / 1000;
          if (elapsed > 0) setSpeedBps(received / elapsed);
        }
        blob = new Blob(chunks, { type: res.headers.get("content-type") || "application/pdf" });
      }

      saveBlob(blob, "دراسة الكتب بالتدريج.pdf");
      // Open the file itself once it's fully on-device, so the admin/student
      // sees the PDF right away instead of just a "downloaded" toast.
      const viewUrl = URL.createObjectURL(blob);
      window.open(viewUrl, "_blank");
      setTimeout(() => URL.revokeObjectURL(viewUrl), 60000);
    } catch {
      window.open(fileUrl, "_blank", "noreferrer");
    } finally {
      setDownloading(false);
    }
  }

  const percent = totalBytes > 0 ? Math.min(100, Math.round((bytesDone / totalBytes) * 100)) : 0;
  const etaSeconds =
    speedBps > 0 && totalBytes > 0 ? Math.max(0, (totalBytes - bytesDone) / speedBps) : null;

  return (
    <div className="curriculum-pdf-panel">
      <div className="curriculum-pdf-info">
        <span className="curriculum-pdf-info-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 3v4a1 1 0 0 0 1 1h4" />
            <path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z" />
            <path d="M9 13h6M9 17h6M9 9h1" />
          </svg>
        </span>
        <span className="curriculum-pdf-info-text">
          <span className="curriculum-pdf-info-title">ملف دراسة المنهج بالترتيب</span>
          <span className="curriculum-pdf-info-sub">
            جدول يرتّب كل كتب المنهج حسب تسلسل الدراسة المقترح
          </span>
        </span>
      </div>

      {isSuperadmin && editing ? (
        <div className="curriculum-pdf-url-form">
          <input
            type="url"
            placeholder="رابط ملف PDF (مثلًا من archive.org)"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
          <button type="button" onClick={handleSave} disabled={saving || !urlInput.trim()}>
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </button>
          <button type="button" className="cancel" onClick={() => setEditing(false)} disabled={saving}>
            إلغاء
          </button>
        </div>
      ) : (
        <div className="curriculum-pdf-actions">
          {isSuperadmin && (
            <button type="button" className="curriculum-pdf-btn upload" onClick={() => setEditing(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 21V9m0 0-4 4m4-4 4 4" />
                <path d="M4 21h16" />
              </svg>
              {fileUrl ? "تعديل الرابط" : "إضافة رابط"}
            </button>
          )}

          <button
            type="button"
            className="curriculum-pdf-btn download"
            onClick={handleDownload}
            disabled={!fileUrl || downloading}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
            </svg>
            {downloading ? "جارٍ التنزيل..." : "تنزيل"}
          </button>

          {isSuperadmin && (
            <button
              type="button"
              className="curriculum-pdf-btn delete"
              onClick={handleDelete}
              disabled={!fileUrl || deleting}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" />
              </svg>
              {deleting ? "جارٍ الحذف..." : "حذف"}
            </button>
          )}
        </div>
      )}

      {downloading &&
        createPortal(
          <div className="modal-overlay">
            <div className="modal-card curriculum-pdf-download-modal">
              <div className="download-all-header">
                <span>جارٍ تنزيل ملف الخطة</span>
              </div>
              <div className="download-all-progress">
                <div className="download-all-bar-row">
                  <div className="leaderboard-bar download-all-bar">
                    <div className="leaderboard-bar-fill" style={{ width: `${percent}%` }} />
                  </div>
                  <span className="download-all-percent">{percent}%</span>
                </div>
                <div className="download-all-stats" dir="rtl">
                  <span>
                    الوقت المتبقي تقريبًا: <strong>{formatEta(etaSeconds)}</strong>
                  </span>
                  <span className="download-all-stats-sep">·</span>
                  <span>
                    {formatBytes(bytesDone)} من {totalBytes ? formatBytes(totalBytes) : "؟"}
                  </span>
                  {speedBps > 0 && (
                    <>
                      <span className="download-all-stats-sep">·</span>
                      <span dir="ltr">{formatSpeed(speedBps)}</span>
                    </>
                  )}
                </div>
              </div>
              <p className="curriculum-pdf-download-hint">لا تغلق الصفحة حتى تنتهي التنزيل — سيُفتح الملف تلقائيًا بعد الانتهاء.</p>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

function AddBookForm({ onAdd, onCancel }) {
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [note, setNote] = useState("");

  function handleSubmit() {
    const t = title.trim();
    if (!t) return;
    onAdd({ title: t, author: author.trim(), note: note.trim() });
  }

  return (
    <li className="study-plan-book study-plan-book-add-form">
      <p className="study-plan-book-add-title">إضافة كتاب جديد</p>
      <input type="text" placeholder="عنوان الكتاب" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input type="text" placeholder="المؤلف" value={author} onChange={(e) => setAuthor(e.target.value)} />
      <input
        type="text"
        placeholder="الشرح (مثلًا: شرح فلان ثم شرح علّان)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="study-plan-book-edit-actions">
        <button type="button" onClick={handleSubmit} disabled={!title.trim()}>
          إضافة
        </button>
        <button type="button" className="cancel" onClick={onCancel}>
          إلغاء
        </button>
      </div>
    </li>
  );
}

function ReorderPanel({ books, onSave, onCancel }) {
  const [list, setList] = useState(books);
  const [saving, setSaving] = useState(false);

  function move(from, to) {
    if (to < 0 || to >= list.length) return;
    setList((cur) => {
      const next = [...cur];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(list);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="reorder-panel">
      <ol className="reorder-list">
        {list.map((b, i) => (
          <li key={b.title} className="reorder-item">
            <span className="reorder-item-num">{i + 1}</span>
            <span className="reorder-item-title">{b.title}</span>
            <span className="reorder-item-controls">
              <button
                type="button"
                onClick={() => move(i, 0)}
                disabled={i === 0}
                aria-label="نقل إلى الأول"
                title="نقل إلى الأول"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 19V6M6 11l6-6 6 6" />
                  <path d="M6 19h12" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => move(i, i - 1)}
                disabled={i === 0}
                aria-label="تحريك لأعلى"
                title="تحريك لأعلى"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 19V6M6 11l6-6 6 6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => move(i, i + 1)}
                disabled={i === list.length - 1}
                aria-label="تحريك لأسفل"
                title="تحريك لأسفل"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 5v13M6 13l6 6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => move(i, list.length - 1)}
                disabled={i === list.length - 1}
                aria-label="نقل إلى الأخير"
                title="نقل إلى الأخير"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 5v13M6 13l6 6 6-6" />
                  <path d="M6 5h12" />
                </svg>
              </button>
            </span>
          </li>
        ))}
      </ol>
      <div className="reorder-actions">
        <button type="button" className="reorder-save" onClick={handleSave} disabled={saving}>
          {saving ? "جارٍ الحفظ..." : "حفظ الترتيب"}
        </button>
        <button type="button" className="reorder-cancel" onClick={onCancel} disabled={saving}>
          إلغاء
        </button>
      </div>
    </div>
  );
}

export default function StudyPlanSection() {
  const { isSuperadmin } = useAuth();
  const { sections, overrides, saveOverrides } = useCurriculumPlan();
  const [addingSection, setAddingSection] = useState(null);
  const [reorderingSection, setReorderingSection] = useState(null);

  function handleSaveEdit(bookTitle, patch) {
    const section = sections.find((s) => s.books.some((b) => b.title === bookTitle));
    const nextEdits = { ...overrides.edits };

    if (section) {
      // Re-number the whole section around the requested position instead of
      // just stamping the number, so assigning an already-taken number
      // inserts the book there and pushes the rest down instead of colliding.
      const targetOrder = Math.min(Math.max(1, patch.order || 1), section.books.length);
      const book = section.books.find((b) => b.title === bookTitle);
      const reordered = section.books.filter((b) => b.title !== bookTitle);
      reordered.splice(targetOrder - 1, 0, book);
      reordered.forEach((b, i) => {
        nextEdits[b.title] = { ...(nextEdits[b.title] || {}), order: i + 1 };
      });
    }

    nextEdits[bookTitle] = { ...(nextEdits[bookTitle] || {}), author: patch.author, note: patch.note };
    saveOverrides({ edits: nextEdits });
  }

  async function handleSaveOrder(orderedBooks) {
    const nextEdits = { ...overrides.edits };
    orderedBooks.forEach((b, i) => {
      nextEdits[b.title] = { ...(nextEdits[b.title] || {}), order: i + 1 };
    });
    await saveOverrides({ edits: nextEdits });
    setReorderingSection(null);
  }

  function handleDeleteBook(bookTitle) {
    saveOverrides({ hidden: [...overrides.hidden, bookTitle] });
  }

  function handleAddBook(sectionTitle, newBook) {
    const existing = overrides.added[sectionTitle] || [];
    saveOverrides({ added: { ...overrides.added, [sectionTitle]: [...existing, newBook] } });
    setAddingSection(null);
  }

  function handleDeleteAddedBook(sectionTitle, bookTitle) {
    const existing = overrides.added[sectionTitle] || [];
    saveOverrides({
      added: { ...overrides.added, [sectionTitle]: existing.filter((b) => b.title !== bookTitle) },
    });
  }

  return (
    <div className="study-plan-inline">
      <CurriculumPdfPanel />
      <div className="study-plan-body">
        {sections.map((section) => (
          <div key={section.title} className="study-plan-section">
            <div className="study-plan-section-head">
              <h4 className="study-plan-section-title">{section.title}</h4>
              {isSuperadmin && reorderingSection !== section.title && (
                <button
                  type="button"
                  className="study-plan-reorder-toggle"
                  onClick={() => setReorderingSection(section.title)}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                  </svg>
                  تعديل التسلسل
                </button>
              )}
            </div>

            {reorderingSection === section.title ? (
              <ReorderPanel
                books={section.books}
                onSave={handleSaveOrder}
                onCancel={() => setReorderingSection(null)}
              />
            ) : (
              <ol className="study-plan-books">
                {section.books.map((b) => (
                  <BookCard
                    key={b.title}
                    book={b}
                    order={b.order}
                    onSaveEdit={handleSaveEdit}
                    onDeleteBook={
                      b.isAdded ? () => handleDeleteAddedBook(section.title, b.title) : handleDeleteBook
                    }
                  />
                ))}
                {isSuperadmin &&
                  (addingSection === section.title ? (
                    <AddBookForm
                      onAdd={(newBook) => handleAddBook(section.title, newBook)}
                      onCancel={() => setAddingSection(null)}
                    />
                  ) : (
                    <li className="study-plan-book study-plan-book-add-trigger">
                      <button type="button" onClick={() => setAddingSection(section.title)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                        إضافة كتاب
                      </button>
                    </li>
                  ))}
              </ol>
            )}
          </div>
        ))}
      </div>

      <div className="study-plan-credits">
        <div className="study-plan-credit">
          <span className="study-plan-credit-icon">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2 4 6v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6l-8-4Z" />
            </svg>
          </span>
          <span className="study-plan-credit-text">
            <span className="study-plan-credit-label">إعداد</span>
            <span className="study-plan-credit-name">{STUDY_PLAN_CREDIT_NAME}</span>
            <span className="study-plan-credit-role">{STUDY_PLAN_CREDIT_ROLE}</span>
          </span>
        </div>

        <div className="study-plan-credit study-plan-credit-dev">
          <span className="study-plan-credit-icon dev">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m8 9-3 3 3 3m8-6 3 3-3 3M13 6l-2 12" />
            </svg>
          </span>
          <span className="study-plan-credit-text">
            <span className="study-plan-credit-label">{STUDY_PLAN_DEVELOPER_LABEL}</span>
            <span className="study-plan-credit-name">{STUDY_PLAN_DEVELOPER_NAME}</span>
            <span className="study-plan-credit-role">{STUDY_PLAN_DEVELOPER_ROLE}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

export { BookCard, AddBookForm, ReorderPanel };
