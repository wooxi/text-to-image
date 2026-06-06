"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ groups: 0, keywords: 0, images: 0 });

  useEffect(() => {
    Promise.all([
      fetch("/api/keywords").then((r) => r.json()),
      fetch("/api/history").then((r) => r.json()),
    ]).then(([kwData, histData]) => {
      let kwCount = 0;
      if (kwData.success && Array.isArray(kwData.data)) {
        kwData.data.forEach((g: { keywords: unknown[] }) => {
          kwCount += g.keywords?.length || 0;
        });
        setStats({
          groups: kwData.data.length,
          keywords: kwCount,
          images: histData.success ? (histData.data || []).length : 0,
        });
      }
    });
  }, []);

  const statStyle = (value: number) => ({
    color: value > 0 ? "var(--accent)" : "var(--text-muted)",
  });

  return (
    <div>
      <h1 className="text-xl font-bold text-app-text mb-6">管理概览</h1>
      <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {[
          { label: "关键词组", value: stats.groups },
          { label: "关键词总数", value: stats.keywords },
          { label: "已生成图片", value: stats.images },
        ].map((item) => (
          <div
            key={item.label}
            className="bg-app-bg2 border border-app-border rounded-xl p-4"
          >
            <p className="text-xl sm:text-3xl font-bold" style={statStyle(item.value)}>
              {item.value}
            </p>
            <p className="text-sm text-app-text3 mt-1">{item.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Link
          href="/admin/keywords"
          className="bg-app-bg2 border border-app-border rounded-xl p-4 hover:border-app-border-hover transition"
        >
          <h3 className="text-app-text font-medium">关键词管理</h3>
          <p className="text-xs text-app-text3 mt-1">管理词组和关键词</p>
        </Link>
        <Link
          href="/admin/config"
          className="bg-app-bg2 border border-app-border rounded-xl p-4 hover:border-app-border-hover transition"
        >
          <h3 className="text-app-text font-medium">模型配置</h3>
          <p className="text-xs text-app-text3 mt-1">配置 LLM 和生图模型端点</p>
        </Link>
      </div>
    </div>
  );
}
