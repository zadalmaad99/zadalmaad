import SurahAyahPicker from "./SurahAyahPicker";
import { locateAyah } from "../data/quranBoundaries";

export default function UnitPicker({ form, onChange }) {
  const location =
    form.surahNumber && form.ayahTo
      ? locateAyah(Number(form.surahNumber), Number(form.ayahTo))
      : null;

  return (
    <div className="unit-picker">
      <SurahAyahPicker
        surahNumber={form.surahNumber}
        ayahFrom={form.ayahFrom}
        ayahTo={form.ayahTo}
        onChange={onChange}
      />

      {location && (
        <div className="auto-location">
          الجزء {location.juz} · الحزب {location.hizb} · صفحة {location.page}{" "}
          (حسب المصحف المدني، تُحسب تلقائيًا من آخر آية)
        </div>
      )}
    </div>
  );
}
