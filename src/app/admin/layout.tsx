"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  useEffect(() => {
    if (pathname === "/admin/login") { setAuthed(true); return; }
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setAuthed(true);
          setUsername(data.data.username);
        } else {
          setAuthed(false);
        }
      })
      .catch(() => setAuthed(false));
  }, [pathname]);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    sessionStorage.removeItem("admin_user");
    router.push("/admin/login");
  };

  if (authed === null) return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <p className="text-sm text-app-text3 animate-skeleton">加载中...</p>
    </div>
  );

  if (authed === false) { router.push("/admin/login"); return null; }
  if (pathname === "/admin/login") return <>{children}</>;

  const navItems = [
    { href: "/admin", label: "概览" },
    { href: "/admin/keywords", label: "关键词管理" },
    { href: "/admin/config", label: "模型配置" },
    { href: "/admin/history", label: "生成历史" },
  ];

  const sidebar = (
    <>
      <div className="p-4 border-b border-app-border/40">
        <Link href="/" className="text-base font-bold text-app-text">AI 文生图</Link>
        <p className="text-[10px] text-app-text3 mt-1">后台管理</p>
      </div>
      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block px-3 py-2 rounded-md text-sm transition-base"
            style={{
              background: pathname === item.href ? "var(--accent-light)" : "transparent",
              color: pathname === item.href ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t border-app-border/40 space-y-2">
        <button
          onClick={toggle}
          className="w-full text-left px-3 py-1.5 rounded-md text-xs transition-base"
          style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
        >
          {theme === "dark" ? "☀ 浅色" : "🌙 深色"}
        </button>
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] text-app-text3">{username}</span>
          <button
            onClick={handleLogout}
            className="text-[10px] text-app-text3 transition-base hover:text-[var(--danger)]"
          >
            退出
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Mobile top bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-app-border/40 bg-[var(--bg-secondary)]">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-app-text p-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
        <span className="text-sm font-medium text-app-text">后台管理</span>
        <span className="text-xs text-app-text3">{username}</span>
      </div>

      <div className="flex">
        <aside className="hidden lg:flex w-52 flex-col border-r border-app-border/40 bg-[var(--bg-secondary)]" style={{ minHeight: "calc(100vh - 0px)" }}>
          {sidebar}
        </aside>

        {sidebarOpen && (
          <div className="lg:hidden fixed inset-0 z-40 flex">
            <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
            <aside className="relative w-64 flex flex-col z-50 bg-[var(--bg-secondary)]">
              {sidebar}
            </aside>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 overflow-auto min-h-screen">{children}</main>
      </div>
    </div>
  );
}
