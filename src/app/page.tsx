"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import KeywordSelector from "@/components/KeywordSelector";
import ImageUploader from "@/components/ImageUploader";
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
  "4:3":  { "2048": "2048x1536", "1536": "1536x1152", "1024": "1024x768", "512": "1024x768" },
  "3:4":  { "2048": "1536x2048", "1536": "1152x1536", "1024": "768x1024", "512": "768x1024" },
};

function getImageSize(keywords: string[]): string {
  const ratio = SIZE_MAP.find(([p]) => keywords.some((k) => k.includes(p)));
  const tiers = ratio ? SIZE_TIERS[ratio[0]] : SIZE_TIERS["1:1"];
  const key = keywords.find((k) => tiers[k.match(/\d+/)?.[0] || ""]);
  if (key) { const num = key.match(/\d+/)?.[0] || ""; if (tiers[num]) return tiers[num]; }
  return ratio ? ratio[1] : "1024x1024";
}

interface TaskRecord {
  id: number; status: string; type: string;
  keywordNames: string; prompt: string;
  imagePath: string; videoPath: string; error: string;
}

export default function HomePage() {
  const [groups, setGroups] = useState<KeywordGroup[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [records, setRecords] = useState<ImageRecord[]>([]);
  const [loggedIn, setLoggedIn] = useState(false);
  const [mode, setMode] = useState<"keywords" | "manual" | "img2img" | "video">("keywords");
  const [refImage, setRefImage] = useState("");
  const [liveTasks, setLiveTasks] = useState<TaskRecord[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchGroups = useCallback(async () => {
    try { const res = await fetch("/api/keywords"); const data = await res.json(); if (data.success) setGroups(data.data); } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    try { const res = await fetch("/api/history"); const data = await res.json(); if (data.success) setRecords(data.data); } catch {}
  }, []);

  const fetchLiveTasks = useCallback(async () => {
    try { const res = await fetch("/api/tasks?status=pending,processing,failed"); const data = await res.json(); if (data.success) setLiveTasks(data.data); } catch {}
  }, []);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    let emptyCount = 0;
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/tasks?status=pending,processing,failed");
        const data = await res.json();
        if (data.success) {
          setLiveTasks(data.data);
          const active = data.data.filter((t: TaskRecord) => t.status === "pending" || t.status === "processing");
          if (active.length === 0) { emptyCount++; if (emptyCount >= 3 && pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; fetchHistory(); } }
          else { emptyCount = 0; }
        }
      } catch {}
    }, 3000);
  }, [fetchHistory]);

  useEffect(() => {
    fetchGroups();
    fetch("/api/auth/me").then(r => r.json()).then(data => {
      if (data.success && data.data) { setLoggedIn(true); fetchHistory(); fetchLiveTasks(); startPolling(); }
    });
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [fetchGroups]);

  const toggleKeyword = (keyword: string) => {
    setSelected(prev => prev.includes(keyword) ? prev.filter(k => k !== keyword) : [...prev, keyword]);
  };

  const handleGeneratePrompt = async () => {
    if (selected.length === 0) { alert("请至少选择一个关键词"); return; }
    if (!loggedIn) { alert("请先登录"); return; }
    setLoading(true); setStatusText("正在生成提示词..."); setPrompt("");
    try {
      const res = await fetch("/api/generate-prompt", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ keywords: selected }) });
      const data = await res.json();
      if (data.success) setPrompt(data.data.prompt); else alert(data.error || "生成失败");
    } catch { alert("生成出错"); }
    finally { setLoading(false); setStatusText(""); }
  };

  const handleGenerate = async () => {
    if (!loggedIn) { alert("请先登录"); return; }

    const body: Record<string, unknown> = { type: mode, size: "1024x1024" };

    if (mode === "keywords" || mode === "img2img") {
      if (mode === "keywords" && selected.length === 0) { alert("请至少选择一个关键词"); return; }
      body.keywords = selected.join(", ");
      body.size = getImageSize(selected);
    } else if (mode === "manual" || mode === "video") {
      if (!prompt.trim()) { alert("请输入提示词"); return; }
      body.keywords = prompt.trim();
      body.prompt = prompt.trim();
    }

    if ((mode === "img2img" || mode === "video") && refImage) {
      body.image = refImage;
    }

    setLoading(true); setStatusText("正在创建任务...");
    try {
      const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) { alert(data.error || "创建失败"); return; }
      setLiveTasks(prev => [...prev, { id: data.data.taskId, status: "pending", type: mode, keywordNames: mode === "keywords" ? selected.join(", ") : "手动输入", prompt: (body.prompt as string) || "", imagePath: "", videoPath: "", error: "" }]);
      startPolling();
    } catch { alert("创建失败"); }
    finally { setLoading(false); setStatusText(""); }
  };

  const handleDeleteHistory = async (id: number) => {
    if (!confirm("确定删除吗？")) return;
    try { await fetch(`/api/history?id=${id}`, { method: "DELETE" }); fetchHistory(); } catch {}
  };

  const handleDeleteTask = async (id: number) => {
    try { await fetch(`/api/tasks?id=${id}`, { method: "DELETE" }); setLiveTasks(prev => prev.filter(t => t.id !== id)); } catch {}
  };

  const handlePolish = async () => {
    if (!prompt.trim()) { alert("请先输入内容"); return; }
    setStatusText("AI 润色中..."); setLoading(true);
    try {
      const res = await fetch("/api/polish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: prompt }) });
      const data = await res.json();
      if (data.success) setPrompt(data.data.text); else alert(data.error || "润色失败");
    } catch { alert("润色出错"); }
    finally { setLoading(false); setStatusText(""); }
  };

  const tabs = [
    { key: "keywords", label: "关键词组合" },
    { key: "manual", label: "手动输入" },
    { key: "img2img", label: "参考图生图" },
    { key: "video", label: "视频生成" },
  ] as const;

  return (
    <div className="min-h-screen bg-app-bg">
      <Header />
      <main className="max-w-[90rem] mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        {!loggedIn && (
          <div className="mb-4 sm:mb-6 px-4 py-3 rounded-xl text-sm flex items-center justify-between" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            <span>请先登录后才能生成</span>
            <Link href="/admin/login" className="px-4 py-1.5 bg-[var(--accent)] text-white rounded-lg text-xs hover:opacity-90 transition flex-shrink-0 ml-3">去登录</Link>
          </div>
        )}

        <div className="bg-app-bg2 border border-app-border rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex gap-1 mb-4 bg-app-bg rounded-lg p-1 flex-wrap">
            {tabs.map(t => (
              <button key={t.key} onClick={() => setMode(t.key)} className="py-2 px-3 rounded-md text-sm font-medium transition"
                style={{ background: mode === t.key ? "var(--accent)" : "transparent", color: mode === t.key ? "#fff" : "var(--text-secondary)" }}>
                {t.label}
              </button>
            ))}
          </div>

          {(mode === "keywords" || mode === "img2img") && (
            <>
              <h2 className="text-base sm:text-lg font-semibold text-app-text mb-3 sm:mb-4">
                {mode === "img2img" ? "上传参考图" : "选择关键词"}
              </h2>
              {mode === "img2img" && (
                <div className="mb-4">
                  <ImageUploader image={refImage} onChange={setRefImage} />
                </div>
              )}
              <KeywordSelector groups={groups} selected={selected} onToggle={toggleKeyword} />
              {selected.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-app-text3">已选:</span>
                  {selected.map(k => (<span key={k} className="px-2 py-0.5 rounded bg-[var(--accent-light)] text-[var(--accent)] text-xs">{k}</span>))}
                  <span className="text-xs text-app-text3 ml-2">输出: {getImageSize(selected)}</span>
                </div>
              )}
              {mode === "keywords" && (
                <button onClick={handleGeneratePrompt} disabled={loading || selected.length === 0 || !loggedIn}
                  className="mt-4 w-full py-2.5 sm:py-3 text-white font-medium rounded-xl transition text-base sm:text-lg"
                  style={{ background: loading || !loggedIn ? "var(--bg-tertiary)" : "var(--accent)", color: loading || !loggedIn ? "var(--text-muted)" : "#fff" }}>
                  {loading ? statusText : "生成提示词"}
                </button>
              )}
            </>
          )}

          {mode === "video" && (
            <div className="space-y-3">
              <h2 className="text-base sm:text-lg font-semibold text-app-text">视频生成</h2>
              <ImageUploader image={refImage} onChange={setRefImage} />
              <p className="text-xs text-app-text3">{refImage ? "图生视频：上传起始帧 + 描述画面动作" : "文生视频：输入画面描述即可"}</p>
              <div className="relative">
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3}
                  className="w-full px-3 py-2.5 pr-20 bg-app-bg border border-app-border rounded-xl text-sm text-app-text leading-relaxed resize-y focus:outline-none"
                  placeholder="描述视频画面，如：一位古风美女在樱花树下转身回眸，微风吹动发丝，电影感运镜..." />
                <button
                  onClick={handlePolish}
                  disabled={loading || !prompt.trim()}
                  className="absolute bottom-2 right-2 px-3 py-1 text-xs rounded-lg transition text-white"
                  style={{ background: loading || !prompt.trim() ? "var(--bg-tertiary)" : "var(--accent)", color: loading || !prompt.trim() ? "var(--text-muted)" : "#fff" }}
                >
                  {loading && statusText === "AI 润色中..." ? "..." : "AI 润色"}
                </button>
              </div>
            </div>
          )}

          {mode === "manual" && (
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-app-text mb-3">手动输入提示词</h2>
              <p className="text-xs text-app-text3 mb-2">直接输入文生图提示词（英文效果更好）</p>
            </div>
          )}

          {(prompt || mode === "manual" || mode === "img2img" || mode === "video") && (mode !== "keywords" || prompt) && (
            <div className="mt-4 space-y-3 pt-4 border-t border-[var(--border)]">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-app-text">
                  {mode === "video" ? "画面描述" : mode === "img2img" ? "编辑指令" : "提示词"}
                  {"（可编辑后生成）"}
                </label>
                <span className="text-xs text-app-text3">{prompt.length} 字符</span>
              </div>
              <div className="relative">
                <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={4}
                  className="w-full px-3 py-2.5 pr-20 bg-app-bg border border-app-border rounded-xl text-sm text-app-text leading-relaxed resize-y focus:outline-none"
                  placeholder="在此输入或编辑提示词..." />
                <button
                  onClick={handlePolish}
                  disabled={loading || !prompt.trim()}
                  className="absolute bottom-2 right-2 px-3 py-1 text-xs rounded-lg transition text-white"
                  style={{ background: loading || !prompt.trim() ? "var(--bg-tertiary)" : "var(--accent)", color: loading || !prompt.trim() ? "var(--text-muted)" : "#fff" }}
                >
                  {loading && statusText === "AI 润色中..." ? "..." : "AI 润色"}
                </button>
              </div>
            </div>
          )}

          {mode !== "keywords" || prompt ? (
            <button onClick={handleGenerate} disabled={loading || !loggedIn || (!prompt.trim() && mode !== "img2img")}
              className="mt-4 w-full py-2.5 sm:py-3 text-white font-medium rounded-xl transition text-base sm:text-lg"
              style={{ background: loading || !loggedIn ? "var(--bg-tertiary)" : "var(--accent)", color: loading || !loggedIn ? "var(--text-muted)" : "#fff" }}>
              {!loggedIn ? "请先登录" : loading ? statusText : mode === "video" ? "生成视频" : "生成图片"}
            </button>
          ) : null}
        </div>

        <h2 className="text-base sm:text-lg font-semibold text-app-text mb-4">生成作品</h2>
        <MasonryGallery records={records} liveTasks={liveTasks} onDelete={handleDeleteHistory} onDeleteTask={handleDeleteTask} />
      </main>
    </div>
  );
}
