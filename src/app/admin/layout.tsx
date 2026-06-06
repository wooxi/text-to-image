"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [username, setUsername] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/admin/login") {
      setAuthed(true);
      return;
    }
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => {
        if (data.success !== undefined) {
          setAuthed(true);
          const stored = sessionStorage.getItem("admin_user");
          if (stored) setUsername(stored);
        } else {
          setAuthed(false);
        }
      })
      .catch(() => setAuthed(false));
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    sessionStorage.removeItem("admin_user");
    router.push("/admin/login");
  };

  if (authed === null) {
    return (
      <div className="min-h-screen bg-app-bg flex items-center justify-center">
        <p className="text-app-text3">加载中...</p>
      </div>
    );
  }

  if (authed === false) {
    router.push("/admin/login");
    return null;
  }

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const navItems = [
    { href: "/admin", label: "概览" },
    { href: "/admin/keywords", label: "关键词管理" },
    { href: "/admin/config", label: "模型配置" },
    { href: "/admin/history", label: "生成历史" },
  ];

  return (
    <div className="min-h-screen bg-app-bg flex">
      <aside
        className="w-56 border-r flex flex-col"
        style={{ background: "var(--bg-secondary)", borderColor: "var(--border)" }}
      >
        <div className="p-4 border-b" style={{ borderColor: "var(--border)" }}>
          <Link href="/" className="text-lg font-bold text-app-text">AI 文生图</Link>
          <p className="text-xs text-app-text3 mt-1">后台管理</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block px-3 py-2 rounded-lg text-sm transition"
              style={{
                background: pathname === item.href ? "var(--accent)" : "transparent",
                color: pathname === item.href ? "#fff" : "var(--text-secondary)",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs text-app-text3 mb-2">{username}</p>
          <button
            onClick={handleLogout}
            className="w-full text-xs px-3 py-1.5 rounded transition"
            style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
          >
            退出登录
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
