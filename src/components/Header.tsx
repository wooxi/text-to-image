"use client";

import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";

export default function Header() {
  const { theme, toggle } = useTheme();

  return (
    <header
      className="sticky top-0 z-40 border-b border-app-border/80 bg-[var(--bg-elevated)]/95 backdrop-blur-xl"
      style={{ borderColor: "var(--border)" }}
    >
      <div className="mx-auto flex max-w-[124rem] items-center justify-between gap-4 px-4 py-4 sm:px-6 xl:px-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="group flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--border-hover)] bg-[var(--accent-light)] text-lg font-semibold text-[var(--accent)] transition group-hover:scale-[1.03]">
              AI
            </span>
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-app-text3">Creative Workbench</div>
              <div className="text-lg font-semibold tracking-[0.02em] text-app-text">镜头导演台</div>
            </div>
          </Link>
        </div>

        <nav className="flex items-center gap-2 sm:gap-3 text-sm">
          <Link
            href="/"
            className="rounded-full border px-4 py-2 text-sm transition hover:border-[var(--border-hover)] hover:text-app-text"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            创作台
          </Link>
          <Link
            href="/admin"
            className="rounded-full border px-4 py-2 text-sm transition hover:border-[var(--border-hover)] hover:text-app-text"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            后台配置
          </Link>
          <button
            onClick={toggle}
            className="rounded-full border px-4 py-2 text-xs font-medium transition hover:border-[var(--border-hover)] hover:text-app-text"
            style={{
              background: "var(--bg-secondary)",
              borderColor: "var(--border)",
              color: "var(--text-secondary)",
            }}
            title={theme === "dark" ? "切换明亮模式" : "切换暗黑模式"}
          >
            {theme === "dark" ? "浅色界面" : "深色界面"}
          </button>
        </nav>
      </div>
    </header>
  );
}
