"use client";

import Link from "next/link";
import { useTheme } from "@/components/ThemeProvider";

export default function Header() {
  const { theme, toggle } = useTheme();

  return (
    <header
      className="border-b px-6 py-3 flex items-center justify-between"
      style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
    >
      <Link
        href="/"
        className="text-xl font-bold tracking-wide"
        style={{ color: "var(--text-primary)" }}
      >
        AI 文生图
      </Link>
      <nav className="flex gap-4 items-center text-sm">
        <Link
          href="/"
          className="transition"
          style={{ color: "var(--text-secondary)" }}
        >
          首页
        </Link>
        <Link
          href="/admin"
          className="transition"
          style={{ color: "var(--text-secondary)" }}
        >
          后台管理
        </Link>
        <button
          onClick={toggle}
          className="ml-2 px-2 py-1 rounded text-xs border transition"
          style={{
            background: "var(--bg-tertiary)",
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
          }}
          title={theme === "dark" ? "切换明亮模式" : "切换暗黑模式"}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </nav>
    </header>
  );
}
