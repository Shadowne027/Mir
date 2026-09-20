import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({
  theme: "light",
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem("mimir_theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      /* sin storage */
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    try {
      localStorage.setItem("mimir_theme", theme);
    } catch {
      /* sin storage */
    }
  }, [theme]);

  return (
    <ThemeCtx.Provider value={{ theme, toggle: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }}>
      {children}
    </ThemeCtx.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeCtx);
}

/** Botón flotante de modo oscuro — fijo en la esquina inferior derecha, acompaña el scroll. */
export function ThemeToggleFab() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      data-testid="theme-toggle"
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={dark ? "Modo claro" : "Modo oscuro"}
      className="fixed bottom-5 right-5 z-[90] flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-2)] shadow-[0_10px_30px_rgba(2,8,23,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:border-[var(--brand)] hover:text-[var(--brand-text)] active:scale-90"
    >
      <span className="relative block h-5 w-5">
        <Sun
          size={20}
          className={`absolute inset-0 transition-all duration-300 ${
            dark ? "rotate-90 scale-50 opacity-0" : "rotate-0 scale-100 opacity-100"
          }`}
        />
        <Moon
          size={20}
          className={`absolute inset-0 transition-all duration-300 ${
            dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-50 opacity-0"
          }`}
        />
      </span>
    </button>
  );
}
