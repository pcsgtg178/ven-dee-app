"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  className?: string;
  size?: "sm" | "md";
}

export default function ThemeToggle({
  className = "",
  size = "md",
}: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check current state from document
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);

    const handleThemeEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ isDark: boolean }>;
      if (customEvent.detail !== undefined) {
        setIsDark(customEvent.detail.isDark);
      }
    };

    window.addEventListener("vendee_theme_changed", handleThemeEvent);
    return () => {
      window.removeEventListener("vendee_theme_changed", handleThemeEvent);
    };
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);

    if (nextDark) {
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("vendee_theme", "dark");
      } catch {}
    } else {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.setItem("vendee_theme", "light");
      } catch {}
    }

    window.dispatchEvent(
      new CustomEvent("vendee_theme_changed", { detail: { isDark: nextDark } })
    );
  };

  if (!mounted) {
    // Return placeholder to avoid layout shift
    return (
      <div
        className={`flex items-center justify-center rounded-full text-text-muted ${
          size === "sm" ? "h-8 w-8" : "h-9 w-9"
        } ${className}`}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer active:scale-90 ${
        isDark
          ? "bg-zinc-800 text-amber-400 hover:bg-zinc-700 hover:text-amber-300 ring-1 ring-zinc-700 shadow-2xs"
          : "bg-surface-subtle text-slate-700 hover:bg-slate-200 hover:text-slate-900 ring-1 ring-slate-200/70 shadow-2xs"
      } ${size === "sm" ? "h-8 w-8" : "h-9 w-9"} ${className}`}
      aria-label={isDark ? "เปลี่ยนเป็นโหมดสว่าง" : "เปลี่ยนเป็นโหมดมืด"}
      title={isDark ? "เปลี่ยนเป็นโหมดสว่าง (Light Mode)" : "เปลี่ยนเป็นโหมดมืด (Dark Mode)"}
    >
      {isDark ? (
        <Sun className="h-4 w-4 transition-transform duration-300 rotate-0 hover:rotate-45 text-amber-400" />
      ) : (
        <Moon className="h-4 w-4 transition-transform duration-300 -rotate-12 hover:rotate-0 text-slate-700" />
      )}
    </button>
  );
}
