import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { darkColors, lightColors, type ThemeColors } from "../theme/colors";
import { type Locale, t as translate } from "./i18n";

const STORAGE_KEY = "autofinder_prefs_v1";

export type ThemeMode = "dark" | "light";

type Prefs = {
  theme: ThemeMode;
  locale: Locale;
};

type PreferencesContextValue = {
  ready: boolean;
  theme: ThemeMode;
  locale: Locale;
  colors: ThemeColors;
  t: (key: Parameters<typeof translate>[1]) => string;
  setTheme: (mode: ThemeMode) => void;
  setLocale: (locale: Locale) => void;
};

const defaultPrefs: Prefs = { theme: "dark", locale: "ru" };

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setPrefs({ ...defaultPrefs, ...JSON.parse(raw) });
      } catch {
        /* ignore */
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback((next: Prefs) => {
    setPrefs(next);
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const setTheme = useCallback(
    (theme: ThemeMode) => {
      setPrefs((prev) => {
        const next = { ...prev, theme };
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const setLocale = useCallback(
    (locale: Locale) => {
      setPrefs((prev) => {
        const next = { ...prev, locale };
        void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const colors = prefs.theme === "light" ? lightColors : darkColors;

  const value = useMemo(
    () => ({
      ready,
      theme: prefs.theme,
      locale: prefs.locale,
      colors,
      t: (key: Parameters<typeof translate>[1]) => translate(prefs.locale, key),
      setTheme,
      setLocale,
    }),
    [ready, prefs, colors, setTheme, setLocale]
  );

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesContextValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used within PreferencesProvider");
  return ctx;
}
