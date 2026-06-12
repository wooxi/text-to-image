"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function AdminDashboard() {
  const [stats, setStats] = useState<{ groups: number; keywords: number; images: number } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/keywords").then((r) => r.json()),
      fetch("/api/history").then((r) => r.json()),
    ]).then(([kwData, histData]) => {
      let kwCount = 0;
      if (kwData.success && Array.isArray(kwData.data)) {
        kwData.data.forEach((g: { keywords: unknown[] }) => { kwCount += g.keywords?.length || 0; });
        setStats({
          groups: kwData.data.length,
          keywords: kwCount,
          images: histData.success ? (histData.data || []).length : 0,
        });
      }
    });
  }, []);

  const items = [
    { label: "关键词组", value: stats?.groups, href: "/admin/keywords" },
    { label: "关键词总数", value: stats?.keywords, href: "/admin/keywords" },
    { label: "已生成", value: stats?.images, href: "/admin/history" },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold text-app-text mb-6">管理概览</h1>
      <div className="grid grid-cols-3 gap-3 mb-8">
        {items.map((item) => (
          <Link key={item.label} href={item.href} className="panel-soft rounded-lg p-4 transition-base hover:border-[var(--accent)]/30">
            {stats === null ? (
              <div className="space-y-2">
                <div className="h-8 w-12 rounded-sm bg-[var(--border)] animate-skeleton" />
                <div className="h-3 w-16 rounded-sm bg-[var(--border)] animate-skeleton mt-2" />
              </div>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums" style={{ color: item.value && item.value > 0 ? "var(--accent)" : "var(--text-muted)" }}>
                  {item.value}
                </p>
                <p className="text-xs text-app-text3 mt-1">{item.label}</p>
              </>
            )}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/admin/keywords" className="panel-soft rounded-lg p-4 transition-base hover:border-[var(--accent)]/30">
          <h3 className="text-sm font-medium text-app-text">关键词管理</h3>
          <p className="text-[11px] text-app-text3 mt-1">管理词组和关键词，拖拽排序</p>
        </Link>
        <Link href="/admin/config" className="panel-soft rounded-lg p-4 transition-base hover:border-[var(--accent)]/30">
          <h3 className="text-sm font-medium text-app-text">模型配置</h3>
          <p className="text-[11px] text-app-text3 mt-1">配置 LLM / 图片 / 视频 API</p>
        </Link>
      </div>
    </div>
  );
}
