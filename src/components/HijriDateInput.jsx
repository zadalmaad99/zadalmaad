import { gregorianToHijri, hijriToGregorian, HIJRI_MONTHS } from "../data/hijri";

const YEARS = Array.from({ length: 101 }, (_, i) => 1400 + i);

export default function HijriDateInput({ value, onChange }) {
  const today = new Date().toISOString().slice(0, 10);
  const hijri = gregorianToHijri(value || today);

  function update(field, newValue) {
    const next = { ...hijri, [field]: Number(newValue) };
    onChange(hijriToGregorian(next.year, next.month, next.day));
  }

  return (
    <div className="hijri-date-input">
      <select value={hijri.day} onChange={(e) => update("day", e.target.value)}>
        {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      <select value={hijri.month} onChange={(e) => update("month", e.target.value)}>
        {HIJRI_MONTHS.map((name, i) => (
          <option key={name} value={i + 1}>
            {name}
          </option>
        ))}
      </select>
      <select value={hijri.year} onChange={(e) => update("year", e.target.value)}>
        {YEARS.map((y) => (
          <option key={y} value={y}>
            {y} هـ
          </option>
        ))}
      </select>
    </div>
  );
}
