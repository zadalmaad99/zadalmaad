import { SURAHS } from "../data/surahs";

export default function SurahProgressBar({ coveredNumbers }) {
  const count = coveredNumbers.size;

  return (
    <div className="progress-bar-wrap">
      <div className="progress-bar">
        {SURAHS.map((s) => (
          <div
            key={s.number}
            className={
              coveredNumbers.has(s.number)
                ? "progress-seg filled"
                : "progress-seg"
            }
            title={`${s.number}. ${s.name}`}
          />
        ))}
      </div>
      <span className="progress-count">{count} / 114</span>
    </div>
  );
}
