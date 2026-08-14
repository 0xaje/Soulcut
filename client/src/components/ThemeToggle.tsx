import React from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/[0.06] text-white/80 transition-all hover:bg-white/15 hover:text-white dark:border-white/12 dark:bg-white/[0.06] dark:text-white/80 light:border-black/10 light:bg-black/[0.05] light:text-black/80 active:scale-95 ${className}`}
      title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? (
        <Sun size={16} className="text-[#ffd700] transition-transform duration-200 rotate-0 hover:rotate-45" />
      ) : (
        <Moon size={16} className="text-[#6366f1] transition-transform duration-200" />
      )}
    </button>
  );
}
