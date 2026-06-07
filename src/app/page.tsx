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
  imagePath: string; videoPath: string; posterPath: string; progress: number; error: string;
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
  const [refImages, setRefImages] = useState<string[]>([]);
  const [videoRefImages, setVideoRefImages] = useState<string[]>([]);
  const [videoMode, setVideoMode] = useState<"reference" | "keyframes">("reference");
  const [videoWidth, setVideoWidth] = useState(1920);
  const [videoHeight, setVideoHeight] = useState(1080);
  const [videoFrames, setVideoFrames] = useState(121);
  const [videoFps, setVideoFps] = useState(24);
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
          fetchHistory();
          if (active.length === 0) { emptyCount++; if (emptyCount >= 1 && pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } }
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

  const clearSelectedKeywords = () => setSelected([]);

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

    if (mode === "video") {
      body.width = videoWidth;
      body.height = videoHeight;
      body.num_frames = videoFrames;
      body.frame_rate = videoFps;
      body.video_mode = videoMode;
    }

    if (mode === "keywords" || mode === "img2img") {
      if (mode === "keywords" && selected.length === 0) { alert("请至少选择一个关键词"); return; }
      if (mode === "img2img" && selected.length === 0 && !prompt.trim()) { alert("请至少选择关键词或输入编辑指令"); return; }
      body.keywords = selected.join(", ");
      body.size = getImageSize(selected);
      if (mode === "img2img" && prompt.trim()) body.prompt = prompt.trim();
    } else if (mode === "manual" || mode === "video") {
      if (!prompt.trim()) { alert("请输入提示词"); return; }
      body.keywords = prompt.trim();
      body.prompt = prompt.trim();
    }

    if (mode === "img2img") {
      if (refImages.length === 0) { alert("请至少添加一张参考图"); return; }
      body.image = refImages;
    } else if (mode === "video" && videoRefImages.length > 0) {
      if (videoMode === "keyframes" && videoRefImages.length < 2) { alert("关键帧动画至少需要两张图片 URL"); return; }
      body.image = videoRefImages;
    }

    setLoading(true); setStatusText("正在创建任务...");
    try {
      const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!data.success) { alert(data.error || "创建失败"); return; }
      setLiveTasks(prev => [...prev, { id: data.data.taskId, status: "pending", type: mode, keywordNames: mode === "keywords" ? selected.join(", ") : "手动输入", prompt: (body.prompt as string) || "", imagePath: "", videoPath: "", posterPath: "", progress: 0, error: "" }]);
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
      const res = await fetch("/api/polish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: prompt, mode }) });
      const data = await res.json();
      if (data.success) setPrompt(data.data.text); else alert(data.error || "润色失败");
    } catch { alert("润色出错"); }
    finally { setLoading(false); setStatusText(""); }
  };

  const tabs = [
    { key: "keywords", label: "关键词生图", desc: "标签组合生成提示词" },
    { key: "manual", label: "手动生图", desc: "直接输入完整提示词" },
    { key: "img2img", label: "参考图生图", desc: "上传或粘贴参考图" },
    { key: "video", label: "视频生成", desc: "文生视频/图生视频/关键帧" },
  ] as const;

  const activeTasks = liveTasks.filter((task) => task.status === "pending" || task.status === "processing");
  const failedTasks = liveTasks.filter((task) => task.status === "failed");
  const currentMode = tabs.find((tab) => tab.key === mode);
  const outputSize = selected.length > 0 && (mode === "keywords" || mode === "img2img") ? getImageSize(selected) : null;
  const videoDuration = (videoFrames / videoFps).toFixed(1);
  const queueTasks = [...activeTasks, ...failedTasks];

  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <Header />

      <section className="w-full border-b border-app-border bg-app-bg3/30">
        <div className="mx-auto max-w-[120rem] 2xl:max-w-[138rem] px-4 sm:px-6 xl:px-8 2xl:px-10 h-auto min-h-10 py-2 flex items-center gap-4 overflow-x-auto text-xs text-app-text3">
          <span className="whitespace-nowrap"><span className="text-app-text2">模式</span> {currentMode?.label}</span>
          <span className="h-4 w-px bg-app-border flex-shrink-0" />
          <span className="whitespace-nowrap"><span className="text-app-text2">输出</span> {mode === "video" ? `${videoWidth}x${videoHeight}` : outputSize || "待选择"}</span>
          <span className="h-4 w-px bg-app-border flex-shrink-0" />
          <span className="whitespace-nowrap"><span className="text-app-text2">队列</span> {activeTasks.length} 进行中 / {failedTasks.length} 失败</span>
          <span className="h-4 w-px bg-app-border flex-shrink-0" />
          <span className="whitespace-nowrap"><span className="text-app-text2">作品</span> {records.length}</span>
        </div>
      </section>

      <main className="mx-auto max-w-[120rem] 2xl:max-w-[138rem] px-4 sm:px-6 xl:px-8 2xl:px-10 py-6">
        {!loggedIn && (
          <div className="mb-6 px-4 py-3 rounded-lg text-sm flex items-center justify-between border border-app-border shadow-sm" style={{ background: "var(--accent-light)", color: "var(--accent)" }}>
            <span>请先登录后才能生成</span>
            <Link href="/admin/login" className="px-4 py-1.5 bg-[var(--accent)] text-white rounded-md text-xs hover:opacity-90 transition flex-shrink-0 ml-3">去登录</Link>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 2xl:gap-10 items-start">
          <section className="xl:col-span-9 2xl:col-span-10 min-w-0 space-y-6">
            <section className="border border-app-border bg-app-bg2 rounded-lg shadow-sm p-1">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setMode(tab.key)}
                    className="rounded-md px-3 py-2.5 text-left transition"
                    style={{
                      background: mode === tab.key ? "var(--bg-primary)" : "transparent",
                      color: mode === tab.key ? "var(--text-primary)" : "var(--text-secondary)",
                      boxShadow: mode === tab.key ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                    }}
                  >
                    <div className="text-sm font-semibold truncate">{tab.label}</div>
                    <div className="mt-0.5 hidden sm:block text-xs opacity-70 truncate">{tab.desc}</div>
                  </button>
                ))}
              </div>
            </section>

            {(mode === "keywords" || mode === "img2img") && (
              <section className="border border-app-border bg-app-bg2 rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-app-border flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-app-text">参数配置</h2>
                    <p className="mt-1 text-xs text-app-text3">按主体、场景、光线逐步补词即可，不需要把每一组都选满。</p>
                  </div>
                  <span className="text-xs text-app-text3 flex-shrink-0">{selected.length} 已选</span>
                </div>
                <div className="p-4 sm:p-6 space-y-6">
                  {mode === "img2img" && (
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="text-sm font-medium text-app-text">参考图</label>
                        <span className="text-xs text-app-text3">{refImages.length} 张</span>
                      </div>
                      <ImageUploader images={refImages} onChange={setRefImages} />
                    </div>
                  )}

                  <div>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label className="text-sm font-medium text-app-text">关键词</label>
                      {outputSize && <span className="text-xs text-app-text3">{outputSize}</span>}
                    </div>
                    <KeywordSelector groups={groups} selected={selected} onToggle={toggleKeyword} onClear={clearSelectedKeywords} />
                    {selected.length > 0 && (
                      <div className="mt-4 rounded-xl border border-app-border bg-app-bg p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-app-text">已选关键词</h3>
                            <p className="mt-1 text-xs text-app-text3">建议先选 3 到 6 个核心词，再交给模型扩写提示词。</p>
                          </div>
                          <button
                            type="button"
                            onClick={clearSelectedKeywords}
                            className="rounded-md border border-app-border bg-app-bg2 px-3 py-1.5 text-xs text-app-text2 transition hover:text-app-text"
                          >
                            清空已选
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                        {selected.map((keyword) => (
                          <button
                            key={keyword}
                            type="button"
                            onClick={() => toggleKeyword(keyword)}
                            className="rounded-full border border-[var(--accent)] bg-[var(--accent-light)] px-3 py-1.5 text-xs text-[var(--accent)] transition hover:opacity-90"
                          >
                            {keyword}
                          </button>
                        ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {mode === "video" && (
              <section className="border border-app-border bg-app-bg2 rounded-lg shadow-sm overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-app-border flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-app-text">视频配置</h2>
                    <p className="mt-1 text-xs text-app-text3">配置参考图、关键帧和输出参数。</p>
                  </div>
                  <span className="text-xs text-app-text3 flex-shrink-0">约 {videoDuration} 秒</span>
                </div>
                <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2 rounded-lg border border-app-border bg-app-bg p-1">
                      {([
                        ["reference", "参考图/多图"],
                        ["keyframes", "关键帧动画"],
                      ] as ["reference" | "keyframes", string][]).map(([key, label]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setVideoMode(key)}
                          className="rounded-md px-3 py-2 text-xs font-semibold transition"
                          style={{ background: videoMode === key ? "var(--bg-secondary)" : "transparent", color: videoMode === key ? "var(--text-primary)" : "var(--text-secondary)", boxShadow: videoMode === key ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <label className="text-sm font-medium text-app-text">参考图 URL</label>
                        <span className="text-xs text-app-text3">{videoRefImages.length} 条</span>
                      </div>
                      <ImageUploader images={videoRefImages} onChange={setVideoRefImages} allowUpload={false} allowDataUri={false} hint="视频参考图仅支持公网 URL" />
                      <p className="mt-3 text-xs text-app-text3">
                        {videoRefImages.length === 0
                          ? "不添加参考图时按文本生成视频。"
                          : videoMode === "keyframes"
                            ? "关键帧动画至少需要两张公网图片 URL。"
                            : "一张或多张公网图片会约束主体、构图和风格。"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-app-border bg-app-bg p-4">
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-sm font-semibold text-app-text">输出参数</h3>
                        <p className="mt-1 text-xs text-app-text3">{videoWidth}x{videoHeight} · {videoFrames} 帧 · {videoFps}fps</p>
                      </div>
                      <span className="rounded-md bg-[var(--accent-light)] px-2 py-1 text-xs text-[var(--accent)]">{videoDuration}s</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-app-text3">宽度</label>
                        <select value={videoWidth} onChange={e => setVideoWidth(Number(e.target.value))} className="w-full mt-1 px-2 py-2 bg-app-bg2 border border-app-border rounded-md text-xs text-app-text focus:outline-none">
                          <option value={768}>768</option><option value={1080}>1080</option><option value={1152}>1152</option><option value={1920}>1920</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-app-text3">高度</label>
                        <select value={videoHeight} onChange={e => setVideoHeight(Number(e.target.value))} className="w-full mt-1 px-2 py-2 bg-app-bg2 border border-app-border rounded-md text-xs text-app-text focus:outline-none">
                          <option value={576}>576</option><option value={768}>768</option><option value={1080}>1080</option><option value={1152}>1152</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-app-text3">帧数</label>
                        <select value={videoFrames} onChange={e => setVideoFrames(Number(e.target.value))} className="w-full mt-1 px-2 py-2 bg-app-bg2 border border-app-border rounded-md text-xs text-app-text focus:outline-none">
                          <option value={81}>81 (3.4s)</option><option value={121}>121 (5s)</option><option value={201}>201 (8.4s)</option><option value={401}>401 (16.7s)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-app-text3">帧率</label>
                        <select value={videoFps} onChange={e => setVideoFps(Number(e.target.value))} className="w-full mt-1 px-2 py-2 bg-app-bg2 border border-app-border rounded-md text-xs text-app-text focus:outline-none">
                          <option value={8}>8 fps</option><option value={16}>16 fps</option><option value={24}>24 fps</option><option value={30}>30 fps</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section className="border border-app-border bg-app-bg2 rounded-lg shadow-sm overflow-hidden focus-within:border-app-border-hover transition-colors">
              <div className="px-4 sm:px-6 py-4 border-b border-app-border flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-app-text">{mode === "video" ? "画面描述" : mode === "img2img" ? "编辑指令" : "提示词控制台"}</h2>
                  <p className="mt-1 text-xs text-app-text3">{mode === "keywords" ? "先生成提示词，也可以直接编辑后生成。" : currentMode?.desc}</p>
                </div>
                <span className="text-xs text-app-text3 flex-shrink-0">{prompt.length} 字符</span>
              </div>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={mode === "video" ? 10 : 8}
                className="block w-full min-h-[180px] lg:min-h-[240px] 2xl:min-h-[300px] resize-y bg-transparent px-4 sm:px-6 py-4 text-base leading-7 text-app-text placeholder:text-app-text3 focus:outline-none"
                placeholder={mode === "video" ? "描述画面、主体动作、镜头运动和氛围..." : mode === "img2img" ? "输入要保留或修改的内容..." : "输入完整提示词..."}
              />
              <div className="border-t border-app-border px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-app-bg3/30">
                <div className="flex flex-wrap items-center gap-3 text-xs text-app-text3">
                  <span>{prompt.length} 字符</span>
                  <span className="h-3 w-px bg-app-border" />
                  <span>{mode === "video" ? `${videoWidth}x${videoHeight} · ${videoDuration}s` : outputSize || "默认 1024x1024"}</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
                  {mode === "keywords" && (
                    <button
                      onClick={handleGeneratePrompt}
                      disabled={loading || selected.length === 0 || !loggedIn}
                      className="rounded-md border border-app-border bg-app-bg2 px-4 py-2 text-sm font-medium text-app-text2 transition hover:text-app-text disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loading && statusText === "正在生成提示词..." ? "生成中" : "生成提示词"}
                    </button>
                  )}
                  <button
                    onClick={handlePolish}
                    disabled={loading || !prompt.trim()}
                    className="rounded-md border border-app-border bg-app-bg2 px-4 py-2 text-sm font-medium text-app-text2 transition hover:text-app-text disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {loading && statusText === "AI 润色中..." ? "润色中" : "AI 润色"}
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={loading || !loggedIn || (!prompt.trim() && mode !== "img2img")}
                    className="rounded-md px-5 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ background: loading || !loggedIn ? "var(--bg-tertiary)" : "var(--accent)", color: loading || !loggedIn ? "var(--text-muted)" : "#fff" }}
                  >
                    {!loggedIn ? "请先登录" : loading && statusText !== "AI 润色中..." && statusText !== "正在生成提示词..." ? statusText : mode === "video" ? "生成视频" : "生成图片"}
                  </button>
                </div>
              </div>
            </section>

            <section>
              <div className="flex items-end justify-between gap-3 mb-4 border-b border-app-border pb-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-app-text3">Gallery</div>
                  <h2 className="mt-1 text-lg sm:text-xl font-semibold text-app-text">生成结果</h2>
                </div>
                <span className="text-xs text-app-text3">{records.length} 个作品</span>
              </div>
              <MasonryGallery records={records} liveTasks={[]} onDelete={handleDeleteHistory} onDeleteTask={handleDeleteTask} />
            </section>
          </section>

          <aside className="xl:col-span-3 2xl:col-span-2 xl:sticky xl:top-4 h-fit border border-app-border bg-app-bg2 rounded-lg shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-app-border flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-app-text">任务队列</h2>
                <p className="mt-0.5 text-xs text-app-text3">Task Queue</p>
              </div>
              <span className="text-xs text-app-text3 flex-shrink-0">{queueTasks.length}</span>
            </div>

            {queueTasks.length === 0 ? (
              <div className="py-12 px-4 text-center text-sm text-app-text3">暂无任务</div>
            ) : (
              <div className="max-h-[calc(100vh-120px)] overflow-y-auto divide-y divide-app-border">
                {queueTasks.map((task) => (
                  <div key={task.id} className="p-3 bg-app-bg">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-app-text3">#{task.id}</span>
                      <button onClick={() => handleDeleteTask(task.id)} className="text-xs text-app-text3 hover:text-app-text transition flex-shrink-0">删除</button>
                    </div>
                    <div className="mt-2 flex items-center gap-2 min-w-0">
                      <span className="rounded-md border border-app-border bg-app-bg2 px-1.5 py-0.5 text-[11px] text-app-text2 flex-shrink-0">
                        {task.type === "video" ? "视频" : "图片"}
                      </span>
                      <p className="truncate text-xs text-app-text2">{task.prompt || task.keywordNames || "等待处理"}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                      <span style={{ color: task.status === "failed" ? "#ef4444" : "var(--text-muted)" }}>
                        {task.status === "failed" ? "失败" : task.status === "processing" ? "处理中" : "排队中"}
                      </span>
                      <span className="text-app-text3">{task.progress || 0}%</span>
                    </div>
                    <div className="mt-2 h-1 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--accent)] transition-all"
                        style={{ width: `${Math.max(5, Math.min(100, task.progress || (task.status === "failed" ? 100 : 10)))}%` }}
                      />
                    </div>
                    {task.error && <p className="mt-2 text-xs text-red-500 break-words">{task.error}</p>}
                  </div>
                ))}
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
