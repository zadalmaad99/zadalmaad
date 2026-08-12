import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { COUNTRIES, splitPhone } from "../data/countries";
import { useCalendar } from "../context/CalendarContext";

const TOTAL_AYAHS = 6236;
const MEDALS = ["🥇", "🥈", "🥉"];
const SECTIONS = [
  { key: "hifz", label: "حفظ" },
  { key: "qiraah", label: "قراءة" },
  { key: "murajaah", label: "مراجعة" },
];

function statsFor(records, studentId, type) {
  const own = records.filter((r) => r.studentId === studentId && r.type === type);
  const ayahCount = own.reduce((sum, r) => sum + (r.ayahTo - r.ayahFrom + 1), 0);
  const surahCount = new Set(own.map((r) => r.surahNumber)).size;
  return { ayahCount, surahCount };
}

function flagFor(phone) {
  const { dial } = splitPhone(phone);
  return COUNTRIES.find((c) => c.dial === dial)?.flag || "🌐";
}

function whatsappLink(phone) {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

export default function OverviewDashboard({ onNavigate }) {
  const { formatDate } = useCalendar();
  const [students, setStudents] = useState([]);
  const [records, setRecords] = useState([]);

  useEffect(() => {
    const unsubStudents = onSnapshot(
      query(collection(db, "students"), orderBy("name")),
      (snap) => setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubRecords = onSnapshot(collection(db, "records"), (snap) =>
      setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsubStudents();
      unsubRecords();
    };
  }, []);

  const rows = students
    .map((s) => {
      const bySection = Object.fromEntries(
        SECTIONS.map((sec) => [sec.key, statsFor(records, s.id, sec.key)])
      );
      const totalAyahs = SECTIONS.reduce(
        (sum, sec) => sum + bySection[sec.key].ayahCount,
        0
      );
      return {
        id: s.id,
        name: s.name,
        contactType: s.contactType,
        contactValue: s.contactValue,
        createdAt: s.createdAt,
        bySection,
        totalAyahs,
      };
    })
    .filter((r) => r.totalAyahs > 0)
    .sort((a, b) => b.bySection.hifz.ayahCount - a.bySection.hifz.ayahCount || b.totalAyahs - a.totalAyahs);

  return (
    <div className="panel">
      {rows.length === 0 ? (
        <p className="empty">لا توجد بيانات تقدم بعد</p>
      ) : (
        <ol className="overview-list">
          {rows.map((r, i) => (
            <li
              key={r.id}
              className="overview-card overview-card-clickable"
              onClick={() => onNavigate?.("hifz", r.id)}
            >
              <div className="overview-card-head">
                <span className="overview-rank">{MEDALS[i] || `#${i + 1}`}</span>
                <div className="overview-card-title">
                  <span className="overview-name">{r.name}</span>
                  <div className="overview-meta">
                    <span className="overview-meta-item">
                      تاريخ التسجيل: {formatDate(r.createdAt)}
                    </span>
                    {r.contactValue &&
                      (r.contactType === "phone" ? (
                        <a
                          className="whatsapp-link overview-meta-item"
                          href={whatsappLink(r.contactValue)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {flagFor(r.contactValue)} +{r.contactValue}
                          <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1-.2.2-.7.8-.8.9-.2.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5.1-.1.2-.3.4-.4.1-.1.2-.2.2-.4.1-.2 0-.3 0-.4 0-.1-.6-1.4-.8-1.9-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2.9 2.4c.1.2 1.6 2.5 3.9 3.4.5.2 1 .4 1.3.5.5.2 1 .1 1.3.1.4-.1 1.2-.5 1.4-1 .2-.5.2-.9.1-1Z" />
                          </svg>
                        </a>
                      ) : (
                        <span className="overview-meta-item">
                          ✉️ {r.contactValue}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
              <div className="overview-sections">
                {SECTIONS.map((sec) => {
                  const stat = r.bySection[sec.key];
                  const pct = Math.min(100, (stat.ayahCount / TOTAL_AYAHS) * 100);
                  return (
                    <div
                      key={sec.key}
                      className={`overview-section overview-${sec.key} overview-section-clickable`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigate?.(sec.key, r.id);
                      }}
                    >
                      <div className="overview-section-label">
                        <span>{sec.label}</span>
                        <span className="overview-section-stats">
                          {stat.surahCount} سورة · {stat.ayahCount} آية
                        </span>
                      </div>
                      <div className="leaderboard-bar">
                        <div
                          className="leaderboard-bar-fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
