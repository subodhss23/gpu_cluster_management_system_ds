"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Density = "comfortable" | "compact";

export interface Prefs {
  density: Density;
  showToasts: boolean;
  defaultRegionFilter: string;
}

const DEFAULT_PREFS: Prefs = {
  density: "comfortable",
  showToasts: false,
  defaultRegionFilter: "all",
};

const PREF_KEY = "aethergrid-prefs-v2";

interface PrefsContextValue {
  prefs: Prefs;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  resetPrefs: () => void;
}

const PrefsContext = createContext<PrefsContextValue | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PREF_KEY);
      if (raw) setPrefs({ ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) });
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
    const root = document.documentElement;
    root.dataset.density = prefs.density;
  }, [prefs, hydrated]);

  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetPrefs = useCallback(() => setPrefs(DEFAULT_PREFS), []);

  return (
    <PrefsContext.Provider value={{ prefs, setPref, resetPrefs }}>{children}</PrefsContext.Provider>
  );
}

export function usePrefs(): PrefsContextValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used within PrefsProvider");
  return ctx;
}
