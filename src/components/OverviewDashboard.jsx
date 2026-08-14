import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { COUNTRIES, splitPhone } from "../data/countries";
import { useCalendar } from "../context/CalendarContext";
import { api } from "../api";
import SurahProgressBar from "./SurahProgressBar";
import { HADITH_BOOKS } from "../data/hadithBooks";
import AttendanceReportModal from "./AttendanceReportModal";

const TOTAL_AYAHS = 6236;
const TOTAL_HADITHS = HADITH_BOOKS.reduce((sum, b) => sum + b.total, 0);
const MEDALS = ["🥇", "🥈", "🥉"];
const SECTIONS = [
  { key: "hifz", label: "حفظ", resettable: false },
  { key: "qiraah", label: "قراءة", resettable: true },
  { key: "murajaah", label: "مراجعة", resettable: true },
];
const DOMAINS = [
  { key: "quran", label: "القرآن" },
  { key: "hadith", label: "المنهج" },
];

function statsFor(records, studentId, type) {
  const own = records.filter((r) => r.studentId === studentId && r.type === type);
  // Progress is counted from the start of the surah to the last ayah
  // reached, not the width of the entered range, since memorization is
  // cumulative from ayah 1.
  const ayahCount = own.reduce((sum, r) => sum + r.ayahTo, 0);
  const surahCount = new Set(own.map((r) => r.surahNumber)).size;
  const maxSurah = own.reduce((max, r) => Math.max(max, r.surahNumber), 0);
  return { ayahCount, surahCount, maxSurah };
}

function hadithStatsFor(hadithRecords, studentId, type) {
  const own = hadithRecords.filter((r) => r.studentId === studentId && r.type === type);
  const hadithCount = own.reduce((sum, r) => sum + (r.hadithNumber || 0), 0);
  const bookCount = new Set(own.map((r) => r.book)).size;
  return { hadithCount, bookCount };
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
  const [hadithRecords, setHadithRecords] = useState([]);
  const [khatmat, setKhatmat] = useState([]);
  const [search, setSearch] = useState("");
  const [openDomain, setOpenDomain] = useState({});
  const [reportStudent, setReportStudent] = useState(null);

  useEffect(() => {
    const unsubStudents = onSnapshot(
      query(collection(db, "students"), orderBy("name")),
      (snap) => setStudents(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubRecords = onSnapshot(collection(db, "records"), (snap) =>
      setRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubHadithRecords = onSnapshot(collection(db, "hadithRecords"), (snap) =>
      setHadithRecords(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubKhatmat = onSnapshot(collection(db, "khatmat"), (snap) =>
      setKhatmat(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsubStudents();
      unsubRecords();
      unsubHadithRecords();
      unsubKhatmat();
    };
  }, []);

  async function handleKhatm(studentId, type, studentName) {
    if (
      !confirm(
        `تأكيد: سيتم تسجيل أن ${studentName} أكمل ختمة ${
          type === "qiraah" ? "قراءة" : "مراجعة"
        } جديدة، وستُصفَّر سجلات هذا القسم للبدء من جديد. الختمات السابقة تبقى محفوظة. متابعة؟`
      )
    )
      return;
    try {
      await api.completeKhatm({ studentId, type });
    } catch (err) {
      alert(err.message || "تعذّر تسجيل الختمة");
    }
  }

  function toggleDomain(studentId, domain) {
    setOpenDomain((o) => ({
      ...o,
      [studentId]: o[studentId] === domain ? null : domain,
    }));
  }

  const rows = students
    .map((s) => {
      const bySection = Object.fromEntries(
        SECTIONS.map((sec) => [sec.key, statsFor(records, s.id, sec.key)])
      );
      const hadithBySection = Object.fromEntries(
        SECTIONS.map((sec) => [sec.key, hadithStatsFor(hadithRecords, s.id, sec.key)])
      );
      const totalAyahs = SECTIONS.reduce(
        (sum, sec) => sum + bySection[sec.key].ayahCount,
        0
      );
      const totalHadiths = SECTIONS.reduce(
        (sum, sec) => sum + hadithBySection[sec.key].hadithCount,
        0
      );
      const khatmCounts = Object.fromEntries(
        SECTIONS.filter((sec) => sec.resettable).map((sec) => [
          sec.key,
          khatmat.filter((k) => k.studentId === s.id && k.type === sec.key).length,
        ])
      );
      return {
        id: s.id,
        name: s.name,
        contactType: s.contactType,
        contactValue: s.contactValue,
        createdAt: s.createdAt,
        bySection,
        hadithBySection,
        khatmCounts,
        totalAyahs,
        totalHadiths,
      };
    })
    .filter((r) => r.totalAyahs > 0 || r.totalHadiths > 0)
    .sort(
      (a, b) =>
        b.bySection.hifz.maxSurah - a.bySection.hifz.maxSurah ||
        b.bySection.hifz.ayahCount - a.bySection.hifz.ayahCount
    );

  const visibleRows = rows.filter((r) =>
    r.name?.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="panel">
      {rows.length > 0 && (
        <div className="search-box">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="ابحث عن اسم الطالب..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      )}

      {visibleRows.length === 0 ? (
        <p className="empty">لا توجد نتائج</p>
      ) : (
        <ol className="overview-list">
          {visibleRows.map((r) => {
            const i = rows.indexOf(r);
            const active = openDomain[r.id];
            return (
            <li key={r.id} className="overview-card">
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

              <button
                type="button"
                className="attendance-report-btn overview-attendance-report-btn"
                onClick={() => setReportStudent({ id: r.id, name: r.name })}
              >
                تقرير الحضور
              </button>

              <div className="overview-domains">
                {DOMAINS.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    className={active === d.key ? "domain-pill active" : "domain-pill"}
                    onClick={() => toggleDomain(r.id, d.key)}
                  >
                    {d.label}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={active === d.key ? "chevron chevron-open" : "chevron"}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </button>
                ))}
              </div>

              {active === "quran" && (
                <div className="overview-sections">
                  {SECTIONS.map((sec) => {
                    const stat = r.bySection[sec.key];
                    const pct = Math.min(100, (stat.ayahCount / TOTAL_AYAHS) * 100);
                    const completed = stat.maxSurah >= 114;
                    return (
                      <div
                        key={sec.key}
                        className={`overview-section overview-${sec.key} overview-section-clickable`}
                        onClick={() => onNavigate?.(sec.key, r.id, "quran")}
                      >
                        <div className="overview-section-label">
                          <span>
                            {sec.label}
                            {sec.resettable && r.khatmCounts[sec.key] > 0 && (
                              <span className="khatm-count">
                                {" "}
                                · {r.khatmCounts[sec.key]} ختمة
                              </span>
                            )}
                          </span>
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
                        <SurahProgressBar maxSurah={stat.maxSurah} />

                        {completed && !sec.resettable && (
                          <div className="khatm-badge khatm-badge-permanent">
                            ✅ ختم القرآن حفظًا
                          </div>
                        )}
                        {completed && sec.resettable && (
                          <button
                            type="button"
                            className="khatm-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleKhatm(r.id, sec.key, r.name);
                            }}
                          >
                            🎉 ختم القرآن {sec.label} — تسجيل والبدء من جديد
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {active === "hadith" && (
                <div className="overview-sections">
                  {SECTIONS.map((sec) => {
                    const stat = r.hadithBySection[sec.key];
                    const pct = Math.min(100, (stat.hadithCount / TOTAL_HADITHS) * 100);
                    return (
                      <div
                        key={sec.key}
                        className={`overview-section overview-${sec.key} overview-section-clickable`}
                        onClick={() => onNavigate?.(sec.key, r.id, "hadith")}
                      >
                        <div className="overview-section-label">
                          <span>{sec.label}</span>
                          <span className="overview-section-stats">
                            {stat.bookCount} كتاب · {stat.hadithCount} حديث
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
              )}
            </li>
            );
          })}
        </ol>
      )}

      {reportStudent && (
        <AttendanceReportModal
          studentId={reportStudent.id}
          studentName={reportStudent.name}
          onClose={() => setReportStudent(null)}
          onViewDetails={() => {
            const id = reportStudent.id;
            setReportStudent(null);
            onNavigate?.("attendance", id);
          }}
        />
      )}
    </div>
  );
}
