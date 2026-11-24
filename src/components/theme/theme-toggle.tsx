"use client";

import { Moon, Sun, Laptop } from "lucide-react";
import { useTheme } from "./theme-provider";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={`inline-flex items-center rounded-lg border border-border bg-surface p-0.5 text-xs ${className ?? ""}`}
      role="group"
      aria-label="Theme preference"
    >
      <button
        type="button"
        onClick={() => setTheme("light")}
        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          theme === "light"
            ? "bg-surface-elevated text-text-primary shadow-sm"
            : "text-text-muted hover:text-text-secondary"
        }`}
        aria-pressed={theme === "light"}
        title="Light theme"
      >
        <Sun className="size-3.5" />
        <span>Light</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme("dark")}
        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          theme === "dark"
            ? "bg-surface-elevated text-text-primary shadow-sm"
            : "text-text-muted hover:text-text-secondary"
        }`}
        aria-pressed={theme === "dark"}
        title="Dark theme"
      >
        <Moon className="size-3.5" />
        <span>Dark</span>
      </button>

      <button
        type="button"
        onClick={() => setTheme("system")}
        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
          theme === "system"
            ? "bg-surface-elevated text-text-primary shadow-sm"
            : "text-text-muted hover:text-text-secondary"
        }`}
        aria-pressed={theme === "system"}
        title="System theme"
      >
        <Laptop className="size-3.5" />
        <span>System</span>
      </button>
    </div>
  );
}

export function CompactThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const toggle = () => {
    if (theme === "dark") setTheme("light");
    else if (theme === "light") setTheme("system");
    else setTheme("dark");
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      title="Change theme"
      aria-label="Change theme"
      className="size-8"
    >
      {resolvedTheme === "light" ? (
        <Sun className="size-4 text-warning" />
      ) : (
        <Moon className="size-4 text-accent-cyan" />
      )}
    </Button>
  );
}
