"use client";

import { useState, useEffect, useCallback } from "react";
import { ImageRecord } from "@/types";

export default function HistoryPage() {
  const [records, setRecords] = useState<ImageRecord[]>([]);

  const fetchHistory = useCallback(async () => {
    const res = await fetch("/api/history");
    const data = await res.json();
    if (data.success) setRecords(data.data);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除这条记录和对应的图片吗？")) return;
    const res = await fetch(`/api/history?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      fetchHistory();
    } else {
      alert(data.error || "删除失败");
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString("zh-CN");
    } catch {
      return dateStr;
    }
  };

  return (
    <div>
      <h1 className="text-xl font-bold text-app-text mb-6">生成历史</h1>

      {records.length === 0 && (
        <p className="text-app-text3 text-center py-10">暂无生成记录。</p>
      )}

      <div className="space-y-4">
        {records.map((record) => (
          <div
            key={record.id}
            className="bg-app-bg2 border border-app-border rounded-xl overflow-hidden flex"
          >
            <img
              src={record.imagePath}
              alt={record.prompt}
              className="w-32 h-32 object-cover flex-shrink-0"
            />
            <div className="p-3 flex-1 min-w-0">
              <p className="text-xs text-app-text3 mb-1">
                关键词: <span className="text-app-text2">{record.keywordNames}</span>
              </p>
              <p className="text-xs text-app-text3 line-clamp-3 mb-2">{record.prompt}</p>
              <p className="text-xs text-app-text3">{formatDate(record.createdAt)}</p>
            </div>
            <div className="p-3 flex flex-col justify-center gap-2">
              <button
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = record.imagePath;
                  a.download = record.imagePath.split("/").pop() || "image.png";
                  a.click();
                }}
                className="px-3 py-1 text-white text-xs rounded transition whitespace-nowrap"
                style={{ background: "var(--accent)" }}
              >
                下载
              </button>
              <button
                onClick={() => handleDelete(record.id)}
                className="px-3 py-1 text-xs rounded transition whitespace-nowrap"
                style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
              >
                删除
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
