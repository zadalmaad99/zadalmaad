import { SURAHS } from "../data/surahs";

export default function SurahAyahPicker({
  surahNumber,
  ayahFrom,
  ayahTo,
  onChange,
}) {
  const surah = SURAHS.find((s) => s.number === Number(surahNumber));
  const maxAyah = surah ? surah.ayahs : 1;

  function handleSurahChange(e) {
    const num = Number(e.target.value);
    onChange({ surahNumber: num, ayahFrom: 1, ayahTo: 1 });
  }

  function handleFromChange(e) {
    const val = Math.min(Math.max(1, Number(e.target.value)), maxAyah);
    onChange({
      surahNumber: Number(surahNumber),
      ayahFrom: val,
      ayahTo: Math.max(val, Number(ayahTo) || val),
    });
  }

  function handleToChange(e) {
    const val = Math.min(Math.max(1, Number(e.target.value)), maxAyah);
    onChange({
      surahNumber: Number(surahNumber),
      ayahFrom: Number(ayahFrom),
      ayahTo: val,
    });
  }

  return (
    <div className="picker-row">
      <label>
        السورة
        <select value={surahNumber} onChange={handleSurahChange} required>
          <option value="">اختر السورة</option>
          {SURAHS.map((s) => (
            <option key={s.number} value={s.number}>
              {s.number}. {s.name} ({s.ayahs} آية)
            </option>
          ))}
        </select>
      </label>

      <label>
        من آية
        <input
          type="number"
          min={1}
          max={maxAyah}
          value={ayahFrom}
          onChange={handleFromChange}
          disabled={!surahNumber}
          required
        />
      </label>

      <label>
        إلى آية
        <input
          type="number"
          min={1}
          max={maxAyah}
          value={ayahTo}
          onChange={handleToChange}
          disabled={!surahNumber}
          required
        />
      </label>
    </div>
  );
}
