import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";

function extractYoutubeId(url) {
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

// Same red/yellow/green tiers used on the book cards, so a glance here
// matches what the viewer themselves would see.
function progressTier(percent) {
  if (percent < 30) return "#f87171";
  if (percent <= 70) return "#fbbf24";
  return "#4ade80";
}

// Owner-only: every signed-in viewer's YouTube watch progress, broken down
// per lesson (not just an average) — expandable per person, with the book,
// sheikh, and lesson name resolved from the same curriculumAudio data the
// المنهج section reads, not just a bare video ID.
export default function AllUsersProgress() {
  const { isSupersuperadmin } = useAuth();
  const [byUid, setByUid] = useState({});
  const [pdfByUid, setPdfByUid] = useState({});
  const [students, setStudents] = useState({});
  const [admins, setAdmins] = useState({});
  const [videoMap, setVideoMap] = useState({});
  const [expanded, setExpanded] = useState(false);
  const [expandedUid, setExpandedUid] = useState(null);
  const [resettingUid, setResettingUid] = useState(null);

  // Clears the tracked watch STATISTICS only (videoProgress docs) — never
  // touches any uploaded curriculum content. The card list here updates the
  // moment the deletes land, since it's driven by the same onSnapshot below;
  // book cards read this per-viewer so there's nothing else to push to.
  async function handleResetStats(uid, videoIds, pdfDocIds) {
    const total = videoIds.length + pdfDocIds.length;
    if (!window.confirm(`هل تريد تصفير إحصائيات هذا المستخدم (${total} عنصر)؟ لا يمكن التراجع.`)) return;
    setResettingUid(uid);
    try {
      await Promise.all([
        ...videoIds.map((vid) => deleteDoc(doc(db, "videoProgress", `${uid}_${vid}`))),
        ...pdfDocIds.map((id) => deleteDoc(doc(db, "pdfProgress", id))),
      ]);
    } catch {
      window.alert("تعذّر التصفير — تحقّق من اتصال الإنترنت وحاول مجددًا");
    } finally {
      setResettingUid(null);
    }
  }

  useEffect(() => {
    if (!isSupersuperadmin) return;
    const unsub = onSnapshot(collection(db, "videoProgress"), (snap) => {
      const grouped = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (!data.uid) return;
        (grouped[data.uid] ||= []).push(data);
      });
      setByUid(grouped);
    });
    return unsub;
  }, [isSupersuperadmin]);

  useEffect(() => {
    if (!isSupersuperadmin) return;
    const unsub = onSnapshot(collection(db, "pdfProgress"), (snap) => {
      const grouped = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        if (!data.uid) return;
        (grouped[data.uid] ||= []).push({ ...data, docId: d.id });
      });
      setPdfByUid(grouped);
    });
    return unsub;
  }, [isSupersuperadmin]);

  // Names live in one of two places depending on role: students/{uid}.name
  // for students, admins/{uid}.name for teachers — users/{uid} only has the
  // role and login email, no display name.
  useEffect(() => {
    if (!isSupersuperadmin) return;
    const unsub = onSnapshot(collection(db, "students"), (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        map[d.id] = d.data();
      });
      setStudents(map);
    });
    return unsub;
  }, [isSupersuperadmin]);

  useEffect(() => {
    if (!isSupersuperadmin) return;
    const unsub = onSnapshot(collection(db, "admins"), (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        map[d.id] = d.data();
      });
      setAdmins(map);
    });
    return unsub;
  }, [isSupersuperadmin]);

  // One-time-ish map from a YouTube video ID to which book/sheikh/lesson it
  // belongs to, built from the same curriculumAudio docs the المنهج page
  // itself reads — covers both the study-plan and hadith-books sections
  // since they're stored in the same collection.
  useEffect(() => {
    if (!isSupersuperadmin) return;
    const unsub = onSnapshot(collection(db, "curriculumAudio"), (snap) => {
      const map = {};
      snap.docs.forEach((d) => {
        const bySheikh = d.data()?.bySheikh || {};
        Object.entries(bySheikh).forEach(([sheikh, lessons]) => {
          (Array.isArray(lessons) ? lessons : []).forEach((lesson) => {
            const vid = extractYoutubeId(lesson?.url || "");
            if (vid) map[vid] = { book: d.id, sheikh, lesson: lesson.title };
          });
        });
      });
      setVideoMap(map);
    });
    return unsub;
  }, [isSupersuperadmin]);

  if (!isSupersuperadmin) return null;

  const allUids = new Set([...Object.keys(byUid), ...Object.keys(pdfByUid)]);
  const rows = [...allUids]
    .map((uid) => {
      const items = byUid[uid] || [];
      const pdfItems = pdfByUid[uid] || [];
      const student = students[uid];
      const admin = admins[uid];
      const email = items.find((i) => i.email)?.email || pdfItems.find((i) => i.email)?.email || null;
      const isOwnerEmail = email === "mathelove2@gmail.com";
      const isWatchedEmail = email === "admin.zadalmaad@admin.com";
      const name = student?.name || admin?.name || (isOwnerEmail || isWatchedEmail ? email : null);
      const role = student ? "طالب" : admin ? "معلّم" : isOwnerEmail ? "Super X2-Admin" : isWatchedEmail ? "superadmin" : null;
      const videos = items
        .map((i) => {
          const percent = Math.min(100, i.percent ?? Math.round(((i.seconds || 0) / (i.duration || 1)) * 100));
          const info = videoMap[i.videoId];
          return {
            type: "video",
            id: i.videoId,
            percent,
            book: info?.book || null,
            sheikh: info?.sheikh?.replace(/^شرح\s+/, "") || null,
            lesson: info?.lesson || null,
            updatedAt: i.updatedAt || 0,
          };
        });
      const pdfs = pdfItems.map((i) => ({
        type: "pdf",
        id: i.docId,
        percent: Math.min(100, i.percent || 0),
        book: i.title || null,
        sheikh: null,
        lesson: `صفحة ${i.page} من ${i.numPages}`,
        updatedAt: i.updatedAt || 0,
      }));
      const activities = [...videos, ...pdfs].sort((a, b) => b.updatedAt - a.updatedAt);
      const allPercents = activities.map((a) => a.percent);
      const avg = allPercents.length ? Math.round(allPercents.reduce((a, b) => a + b, 0) / allPercents.length) : 0;
      return {
        uid,
        name: name || email || "مستخدم بدون اسم مسجّل",
        role,
        videosStarted: activities.length,
        avgPercent: Math.min(100, avg),
        videos: activities,
        videoIds: items.map((i) => i.videoId),
        pdfDocIds: pdfItems.map((i) => i.docId),
      };
    })
    .sort((a, b) => b.avgPercent - a.avgPercent);

  return (
    <div className="settings-card">
      <button type="button" className="settings-card-title all-progress-toggle" onClick={() => setExpanded((v) => !v)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 20h5v-2a4 4 0 0 0-3-3.87M9 20H4v-2a4 4 0 0 1 3-3.87m5-3.13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-1a4 4 0 1 0 0-8" />
        </svg>
        تقدّم كل المستخدمين ({rows.length})
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`all-progress-chevron${expanded ? " open" : ""}`}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {expanded && (
        <div className="all-progress-cards">
          {rows.length === 0 ? (
            <p className="hint-text">لا يوجد أي تقدّم مسجّل بعد.</p>
          ) : (
            rows.map((r) => {
              const isOpen = expandedUid === r.uid;
              return (
                <div key={r.uid} className={`all-progress-card${isOpen ? " open" : ""}`}>
                  <button
                    type="button"
                    className="all-progress-card-header"
                    onClick={() => setExpandedUid(isOpen ? null : r.uid)}
                  >
                    <span className="all-progress-avatar" style={{ "--avatar-color": progressTier(r.avgPercent) }}>
                      {r.name.trim()[0] || "؟"}
                    </span>
                    <span className="all-progress-card-info">
                      <span className="all-progress-name">
                        {r.name}
                        {r.role && <span className="all-progress-role">{r.role}</span>}
                      </span>
                      <span className="all-progress-track">
                        <span
                          className="all-progress-fill"
                          style={{ width: `${r.avgPercent}%`, background: progressTier(r.avgPercent) }}
                        />
                      </span>
                    </span>
                    <span className="all-progress-summary">
                      <strong>{r.avgPercent}%</strong>
                      <span>{r.videosStarted} عنصر</span>
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`all-progress-chevron${isOpen ? " open" : ""}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {isOpen && (
                    <div className="all-progress-videos">
                      <button
                        type="button"
                        className="all-progress-reset-btn"
                        disabled={resettingUid === r.uid}
                        onClick={() => handleResetStats(r.uid, r.videoIds, r.pdfDocIds)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" />
                        </svg>
                        {resettingUid === r.uid ? "جارٍ التصفير..." : "تصفير إحصائيات هذا المستخدم"}
                      </button>
                      {r.videos.map((v) => (
                        <div key={`${v.type}-${v.id}`} className="all-progress-video-row">
                          <div className="all-progress-video-info">
                            {v.book ? (
                              <>
                                <span className="all-progress-video-book">
                                  {v.type === "pdf" ? "📄 " : ""}
                                  {v.book}
                                </span>
                                <span className="all-progress-video-lesson">
                                  {v.sheikh && <span className="all-progress-video-sheikh">{v.sheikh}</span>}
                                  {v.lesson || "درس"}
                                </span>
                              </>
                            ) : (
                              <span className="all-progress-video-lesson">
                                فيديو غير مرتبط بكتاب حاليًا
                                <span className="all-progress-video-id" dir="ltr">
                                  {v.id}
                                </span>
                              </span>
                            )}
                          </div>
                          <div className="all-progress-video-bar-line">
                            <span className="all-progress-video-percent" style={{ color: progressTier(v.percent) }}>
                              {v.percent}%
                            </span>
                            <span className="all-progress-video-track">
                              <span
                                className="all-progress-video-fill"
                                style={{ width: `${v.percent}%`, background: progressTier(v.percent) }}
                              />
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
