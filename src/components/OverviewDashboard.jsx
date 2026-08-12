import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

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

export default function OverviewDashboard() {
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
      return { id: s.id, name: s.name, bySection, totalAyahs };
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
            <li key={r.id} className="overview-card">
              <div className="overview-card-head">
                <span className="overview-rank">{MEDALS[i] || `#${i + 1}`}</span>
                <span className="overview-name">{r.name}</span>
              </div>
              <div className="overview-sections">
                {SECTIONS.map((sec) => {
                  const stat = r.bySection[sec.key];
                  const pct = Math.min(100, (stat.ayahCount / TOTAL_AYAHS) * 100);
                  return (
                    <div key={sec.key} className={`overview-section overview-${sec.key}`}>
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
