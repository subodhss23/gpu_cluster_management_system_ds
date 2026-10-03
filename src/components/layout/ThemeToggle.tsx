"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";

export type Theme = "dark" | "light";
export const THEME_KEY = "aethergrid-theme";

export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_KEY}');if(t!=='light'&&t!=='dark'){t='dark';}var d=document.documentElement;d.classList.remove('light','dark');d.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`;

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* storage unavailable */
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = document.documentElement.classList.contains("light") ? "light" : "dark";
    setTheme(stored);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle color theme"
      className="relative rounded-lg border border-ink-700 p-2 text-ink-300 transition hover:border-ink-500 hover:text-ink-100"
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} size={16} />
    </button>
  );
}
