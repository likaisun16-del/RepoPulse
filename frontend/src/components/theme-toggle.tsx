"use client";

import { Lightbulb } from "lucide-react";

import { THEME_STORAGE_KEY, type Theme } from "@/lib/preferences";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    return;
  }
}

export function ThemeToggle() {
  function toggleTheme() {
    const nextTheme: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    persistTheme(nextTheme);
  }

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label="切换深色/浅色模式"
      title="切换深色/浅色模式"
    >
      <span className="theme-toggle-glow" aria-hidden="true" />
      <Lightbulb size={18} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );
}
