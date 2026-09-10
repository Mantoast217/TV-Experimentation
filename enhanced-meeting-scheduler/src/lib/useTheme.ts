import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/**
 * Reads/writes the same [data-theme] attribute the inline bootstrap script (index.html)
 * sets before first paint, so this never needs its own separate source of truth — flipping
 * the attribute here is exactly what the CSS in index.css and @heroui/styles already
 * reacts to. Persists the explicit choice to localStorage, which the bootstrap script
 * checks first (ahead of prefers-color-scheme) on every subsequent page load, including
 * privacy.html/terms.html — so a choice made here carries over across the whole site.
 *
 * The mount-time effect (syncing state back onto the attribute) makes this self-sufficient
 * rather than purely dependent on the bootstrap script having already run — e.g. in a test
 * environment that renders the component directly with no such script.
 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(currentTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  };

  return { theme, toggleTheme };
}
