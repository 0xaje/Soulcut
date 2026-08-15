import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-black/5 text-slate-700 transition hover:bg-black/10 hover:text-black dark:border-white/12 dark:bg-white/[0.06] dark:text-white/70 dark:hover:bg-white/12 dark:hover:text-white active:scale-95 ${className}`}
      title={isDark ? "Switch to Day (Light Mode)" : "Switch to Night (Dark Mode)"}
      aria-label={isDark ? "Switch to Day mode" : "Switch to Night mode"}
    >
      <Sun
        size={15}
        className={`absolute transition-all duration-300 ${
          isDark
            ? "rotate-90 scale-0 opacity-0"
            : "rotate-0 scale-100 opacity-100 text-amber-600"
        }`}
      />
      <Moon
        size={15}
        className={`absolute transition-all duration-300 ${
          isDark
            ? "rotate-0 scale-100 opacity-100 text-[#c7ff4b]"
            : "-rotate-90 scale-0 opacity-0"
        }`}
      />
    </button>
  );
}

export default ThemeToggle;
