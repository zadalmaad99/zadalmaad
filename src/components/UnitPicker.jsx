import SurahAyahPicker from "./SurahAyahPicker";

const JUZ_COUNT = 30;
const HIZB_COUNT = 60;
const PAGE_COUNT = 604;

const UNIT_TYPES = [
  { key: "surah", label: "سورة" },
  { key: "juz", label: "جزء" },
  { key: "hizb", label: "حزب" },
  { key: "page", label: "صفحة" },
];

export default function UnitPicker({ form, onChange }) {
  return (
    <div className="unit-picker">
      <div className="contact-toggle">
        <span className="contact-toggle-label">نوع التسجيل</span>
        <div className="contact-toggle-options">
          {UNIT_TYPES.map((u) => (
            <label className="radio-label" key={u.key}>
              <input
                type="radio"
                name="unitType"
                checked={form.unitType === u.key}
                onChange={() => onChange({ unitType: u.key })}
              />
              {u.label}
            </label>
          ))}
        </div>
      </div>

      {form.unitType === "surah" && (
        <SurahAyahPicker
          surahNumber={form.surahNumber}
          ayahFrom={form.ayahFrom}
          ayahTo={form.ayahTo}
          onChange={onChange}
        />
      )}

      {form.unitType === "juz" && (
        <label>
          الجزء
          <select
            value={form.juzNumber}
            onChange={(e) => onChange({ juzNumber: Number(e.target.value) })}
            required
          >
            <option value="">اختر الجزء</option>
            {Array.from({ length: JUZ_COUNT }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                الجزء {n}
              </option>
            ))}
          </select>
        </label>
      )}

      {form.unitType === "hizb" && (
        <label>
          الحزب
          <select
            value={form.hizbNumber}
            onChange={(e) => onChange({ hizbNumber: Number(e.target.value) })}
            required
          >
            <option value="">اختر الحزب</option>
            {Array.from({ length: HIZB_COUNT }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                الحزب {n}
              </option>
            ))}
          </select>
        </label>
      )}

      {form.unitType === "page" && (
        <div className="picker-row">
          <label>
            من صفحة
            <input
              type="number"
              min={1}
              max={PAGE_COUNT}
              value={form.pageFrom}
              onChange={(e) => onChange({ pageFrom: Number(e.target.value) })}
              required
            />
          </label>
          <label>
            إلى صفحة
            <input
              type="number"
              min={1}
              max={PAGE_COUNT}
              value={form.pageTo}
              onChange={(e) => onChange({ pageTo: Number(e.target.value) })}
              required
            />
          </label>
        </div>
      )}
    </div>
  );
}
