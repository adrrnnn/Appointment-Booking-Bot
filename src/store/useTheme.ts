import { useState, useEffect } from "react";

type Theme = "dark" | "light";

const STORAGE_KEY = "app-theme";

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.add("light");
  } else {
    root.classList.remove("light");
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return saved ?? "light";
  });

  // Apply CSS class and sync title bar on every change
  useEffect(() => {
    applyTheme(theme);
    window.api.setTitleBarTheme(theme).catch(() => {});
  }, [theme]);

  // Apply on first render
  useEffect(() => {
    applyTheme(theme);
    window.api.setTitleBarTheme(theme).catch(() => {});
  }, []);

  function setTheme(next: Theme) {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }

  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return { theme, toggle };
}
