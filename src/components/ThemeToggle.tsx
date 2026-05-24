"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div style={{ width: 40, height: 40 }} />;
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="modal-close"
      style={{
        width: 40,
        height: 40,
        border: "1px solid var(--surface-border)",
        background: "var(--surface)",
        fontSize: "1.2rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "10px",
        cursor: "pointer",
        transition: "all 0.2s"
      }}
      aria-label="Toggle theme"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
