import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(null);
const STORAGE_KEY = "quran-tracker-theme";

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem(STORAGE_KEY) || "system"
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, theme);
    if (theme === "system") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
