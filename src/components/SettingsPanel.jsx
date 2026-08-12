import { useCalendar } from "../context/CalendarContext";

export default function SettingsPanel() {
  const { calendar, setCalendar, formatDate } = useCalendar();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="panel">
      <div className="contact-toggle">
        <span className="contact-toggle-label">نظام التقويم لعرض التواريخ</span>
        <div className="contact-toggle-options">
          <label className="radio-label">
            <input
              type="radio"
              name="calendar"
              checked={calendar === "gregorian"}
              onChange={() => setCalendar("gregorian")}
            />
            ميلادي
          </label>
          <label className="radio-label">
            <input
              type="radio"
              name="calendar"
              checked={calendar === "hijri"}
              onChange={() => setCalendar("hijri")}
            />
            هجري
          </label>
        </div>
      </div>
      <p className="hint-text">
        مثال على التاريخ الحالي حسب الاختيار: {formatDate(today)}
      </p>
      <p className="hint-text">
        هذا الاختيار يغيّر طريقة عرض التاريخ في كل الأقسام (تاريخ التسجيل، جدول
        السجلات)، ولا يغيّر البيانات نفسها المخزّنة.
      </p>
    </div>
  );
}
