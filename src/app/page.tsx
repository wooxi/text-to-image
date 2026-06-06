"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import KeywordSelector from "@/components/KeywordSelector";
import MasonryGallery from "@/components/MasonryGallery";
import { KeywordGroup, ImageRecord } from "@/types";

const SIZE_MAP: [string, string][] = [
  ["9:16", "768x1344"], ["16:9", "1344x768"], ["4:3", "1024x768"],
  ["3:4", "768x1024"], ["1:1", "1024x1024"],
];

const SIZE_TIERS: Record<string, Record<string, string>> = {
  "1:1":  { "2048": "2048x2048", "1536": "1536x1536", "1024": "1024x1024", "512": "512x512" },
  "9:16": { "2048": "1440x2560", "1536": "1152x2048", "1024": "768x1344", "512": "768x1344" },
  "16:9": { "2048": "2048x1152", "1536": "1344x768", "1024": "1344x768", "512": "1344x768" },
};

function getImageSize(keywords: string[]): string {
  const ratio = SIZE_MAP.find(([p]) => keywords.some((k) => k.includes(p)));
  const tiers = ratio ? SIZE_TIERS[ratio[0]] : SIZE_TIERS["1:1"];
  const key = keywords.find((k) => tiers[k.match(/\d+/)?.[0] || ""]);
  if (key) {
    const num = key.match(/\d+/)?.[0] || "";
    if (tiers[num]) return tiers[num];
  }
  return ratio ? ratio[1] : "1024x1024";
}

interface TaskRecord {
  id: number;
  status: string;
  keywordNames: string;
  prompt: string;
  imagePath: string;
  error: string;
}

export default function HomePage() {
  const [groups, setGroups] = useState<KeywordGroup[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<ImageRecord[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [mode, setMode] = useState<"keywords" | "manual">("keywords");
  const [liveTasks, setLiveTasks] = useState<TaskRecord[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/keywords");
      const data = await res.json();
      if (data.success) setGroups(data.data);
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (data.success) setRecords(data.data);
    } catch {}
  }, []);

  const fetchLiveTasks = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks?status=pending,processing");
      const data = await res.json();
      if (data.success) setLiveTasks(data.data);
    } catch {}
  }, []);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    let emptyCount = 0;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/tasks?status=pending,processing");
        const data = await res.json();
        if (data.success) {
          setLiveTasks(data.data);
          if (data.data.length === 0) {
            emptyCount++;
            if (emptyCount >= 3 && pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
              fetchHistory();
            }
          } else {
            emptyCount = 0;
          }
        }
      } catch {}
    }, 3000);
  }, [fetchHistory]);

  useEffect(() => {
    fetchGroups();
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.data) {
          setLoggedIn(true);
          fetchHistory();
          fetchLiveTasks();
          if (data.data) startPolling();
        }
      });
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchGroups]);

  const toggleKeyword = (keyword: string) => {
    setSelected((prev) =>
      prev.includes(keyword) ? prev.filter((k) => k !== keyword) : [...prev, keyword]
    );
  };

  const handleGenerate = async () => {
    const finalPrompt = prompt.trim();
    const useKeywords = mode === "keywords";

    if (useKeywords && selected.length === 0) { alert("请至少选择一个关键词"); return; }
    if (!useKeywords && !finalPrompt) { alert("请输入提示词"); return; }
    if (!loggedIn) { alert("请先登录"); return; }

    setLoading(true);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keywords: useKeywords ? selected.join(", ") : finalPrompt,
          size: useKeywords ? getImageSize(selected) : "1024x1024",
        }),
      });
      const data = await res.json();
      if (!data.success) { alert(data.error || "创建任务失败"); return; }

      setLiveTasks((prev) => [...prev, {
        id: data.data.taskId,
        status: "pending",
        keywordNames: useKeywords ? selected.join(", ") : "手动输入",
        prompt: "",
        imagePath: "",
        error: "",
      }]);
      startPolling();
    } catch {
      alert("创建任务失败");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除这张图片吗？")) return;
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) fetchHistory();
      else alert(data.error || "删除失败");
    } catch {
      alert("删除失败");
    }
  };

  return (
    <div className="min-h-screen bg-app-bg">
      <Header />

      <main className="max-w-[90rem] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        {!loggedIn && (
          <div className="mb-4 sm:mb-6 px-4 py-3 rounded-xl text-sm flex items-center justify-between" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            <span>请先登录后才能生成图片</span>
            <Link href="/admin/login" className="px-4 py-1.5 bg-[var(--accent)] text-white rounded-lg text-xs hover:opacity-90 transition flex-shrink-0 ml-3">
              去登录
            </Link>
          </div>
        )}

        <div className="bg-app-bg2 border border-app-border rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex gap-1 mb-4 bg-app-bg rounded-lg p-1">
            <button
              onClick={() => setMode("keywords")}
              className="flex-1 py-2 rounded-md text-sm font-medium transition"
              style={{
                background: mode === "keywords" ? "var(--accent)" : "transparent",
                color: mode === "keywords" ? "#fff" : "var(--text-secondary)",
              }}
            >
              关键词组合
            </button>
            <button
              onClick={() => setMode("manual")}
              className="flex-1 py-2 rounded-md text-sm font-medium transition"
              style={{
                background: mode === "manual" ? "var(--accent)" : "transparent",
                color: mode === "manual" ? "#fff" : "var(--text-secondary)",
              }}
            >
              手动输入
            </button>
          </div>

          {mode === "keywords" ? (
            <>
              <h2 className="text-base sm:text-lg font-semibold text-app-text mb-3 sm:mb-4">选择关键词组合</h2>
              <KeywordSelector groups={groups} selected={selected} onToggle={toggleKeyword} />
              {selected.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-app-text3">已选:</span>
                  {selected.map((k) => (
                    <span key={k} className="px-2 py-0.5 rounded bg-[var(--accent-light)] text-[var(--accent)] text-xs">{k}</span>
                  ))}
                  <span className="text-xs text-app-text3 ml-2">
                    输出: {getImageSize(selected)}
                    {(selected.some(k => k.includes("2K") || k.includes("4K") || k.includes("8K"))) && (
                      <span className="ml-1 opacity-60">(画质已注入提示词)</span>
                    )}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-app-text mb-3">手动输入提示词</h2>
              <p className="text-xs text-app-text3 mb-2">直接输入文生图提示词（英文效果更好），点击生成图片</p>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 bg-app-bg border border-app-border rounded-xl text-sm text-app-text leading-relaxed resize-y focus:outline-none"
                style={{ outlineColor: "var(--accent)" }}
                placeholder="在此输入提示词..."
              />
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={loading || !loggedIn || (mode === "keywords" ? selected.length === 0 : !prompt.trim())}
            className="mt-5 w-full py-2.5 sm:py-3 text-white font-medium rounded-xl transition text-base sm:text-lg"
            style={{
              background: loading || !loggedIn ? "var(--bg-tertiary)" : "var(--accent)",
              color: loading || !loggedIn ? "var(--text-muted)" : "#fff",
            }}
          >
            {!loggedIn ? "请先登录" : loading ? "正在创建任务..." : "生成图片"}
          </button>
        </div>

        <h2 className="text-base sm:text-lg font-semibold text-app-text mb-4">生成作品</h2>
        <MasonryGallery records={records} liveTasks={liveTasks} onDelete={handleDelete} />
      </main>
    </div>
  );
}
