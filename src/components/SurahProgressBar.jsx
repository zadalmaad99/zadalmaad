import { SURAHS } from "../data/surahs";

export default function SurahProgressBar({ maxSurah }) {
  return (
    <div className="progress-bar-wrap">
      <div className="progress-bar">
        {SURAHS.map((s) => (
          <div
            key={s.number}
            className={s.number <= maxSurah ? "progress-seg filled" : "progress-seg"}
            title={`${s.number}. ${s.name}`}
          />
        ))}
      </div>
      <span className="progress-count">{maxSurah} / 114</span>
    </div>
  );
}
