import { createContext, useContext, useEffect, useState } from "react";

const CalendarContext = createContext(null);
const STORAGE_KEY = "quran-tracker-calendar";

const hijriFormatter = new Intl.DateTimeFormat("ar-SA-u-ca-islamic", {
  year: "numeric",
  month: "long",
  day: "numeric",
});
const gregorianFormatter = new Intl.DateTimeFormat("ar-EG", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function CalendarProvider({ children }) {
  const [calendar, setCalendar] = useState(
    () => localStorage.getItem(STORAGE_KEY) || "gregorian"
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, calendar);
  }, [calendar]);

  function formatDate(value) {
    if (!value) return "—";
    const date = typeof value === "number" ? new Date(value) : new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return "—";
    return calendar === "hijri"
      ? hijriFormatter.format(date)
      : gregorianFormatter.format(date);
  }

  return (
    <CalendarContext.Provider value={{ calendar, setCalendar, formatDate }}>
      {children}
    </CalendarContext.Provider>
  );
}

export function useCalendar() {
  return useContext(CalendarContext);
}
