"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import KeywordSelector from "@/components/KeywordSelector";
import ImageUploader from "@/components/ImageUploader";
import MasonryGallery from "@/components/MasonryGallery";
import MobileHome from "@/components/MobileHome";
import { KeywordFacet, KeywordGroup, ImageRecord } from "@/types";

const SIZE_MAP: [string, string][] = [
  ["9:16", "768x1344"], ["16:9", "1344x768"], ["4:3", "1024x768"],
  ["3:4", "768x1024"], ["1:1", "1024x1024"],
];

const SIZE_TIERS: Record<string, Record<string, string>> = {
  "1:1": { "2048": "2048x2048", "1536": "1536x1536", "1024": "1024x1024", "512": "512x512" },
  "9:16": { "2048": "1440x2560", "1536": "1152x2048", "1024": "768x1344", "512": "768x1344" },
  "16:9": { "2048": "2048x1152", "1536": "1344x768", "1024": "1344x768", "512": "1344x768" },
  "4:3": { "2048": "2048x1536", "1536": "1536x1152", "1024": "1024x768", "512": "1024x768" },
  "3:4": { "2048": "1536x2048", "1536": "1152x1536", "1024": "768x1024", "512": "768x1024" },
};

const MODE_META = {
  keywords: {
    label: "关键词导演",
    desc: "按主体、环境、服装、镜头和风格逐层组织画面。",
    eyebrow: "Guided Prompting",
  },
  manual: {
    label: "手动提示词",
    desc: "直接写完整提示词，适合已有经验的精修流程。",
    eyebrow: "Manual Prompt",
  },
  img2img: {
    label: "参考图编辑",
    desc: "保留参考图结构，只改服装、姿态、风格或镜头。",
    eyebrow: "Image Edit",
  },
  video: {
    label: "视频生成",
    desc: "支持文本、参考图和关键帧模式，适配 Agnes 视频参数。",
    eyebrow: "Motion Studio",
  },
} as const;

const KEYWORD_FLOW = [
  { slug: "subject", name: "主体", hint: "先定人物属性和体型气质" },
  { slug: "environment", name: "环境", hint: "再定室内外、天气和时间" },
  { slug: "outfit", name: "穿着", hint: "补服装、配饰、材质" },
  { slug: "pose", name: "姿势", hint: "描述动作、视线和身体表现" },
  { slug: "camera", name: "镜头", hint: "选特写、全身、长焦、构图" },
  { slug: "style", name: "风格", hint: "收口到写实、动漫、电影感" },
  { slug: "output", name: "输出", hint: "单独控制比例和清晰度" },
] as const;

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

function findFacetByKeyword(groups: KeywordGroup[], keyword: string): KeywordFacet | null {
  for (const group of groups) {
    for (const facet of group.facets || []) {
      if (facet.keywords.some((kw) => kw.name === keyword)) return facet;
    }
  }
  return null;
}

function getOutputKeywords(groups: KeywordGroup[], selected: string[]) {
  const outputGroup = groups.find((group) => group.slug === "output");
  if (!outputGroup) return [];
  const outputSet = new Set(outputGroup.keywords.map((kw) => kw.name));
  return selected.filter((keyword) => outputSet.has(keyword));
}

function getSemanticKeywords(groups: KeywordGroup[], selected: string[]) {
  const outputSet = new Set(getOutputKeywords(groups, selected));
  return selected.filter((keyword) => !outputSet.has(keyword));
}

function getGroupSelectionCount(group: KeywordGroup, selected: string[]) {
  return (group.facets || []).reduce(
    (sum, facet) => sum + facet.keywords.filter((kw) => selected.includes(kw.name)).length,
    0,
  );
}

interface TaskRecord {
  id: number;
  status: string;
  type: string;
  keywordNames: string;
  prompt: string;
  imagePath: string;
  videoPath: string;
  posterPath: string;
  progress: number;
  error: string;
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
      const res = await fetch("/api/tasks?status=pending,processing,failed");
      const data = await res.json();
      if (data.success) setLiveTasks(data.data);
    } catch {}
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
          if (active.length === 0) {
            emptyCount++;
            if (emptyCount >= 1 && pollingRef.current) {
              clearInterval(pollingRef.current);
              pollingRef.current = null;
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
          startPolling();
        }
      });
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [fetchGroups, fetchHistory, fetchLiveTasks, startPolling]);

  const toggleKeyword = (keyword: string) => {
    const facet = findFacetByKeyword(groups, keyword);
    if (!facet) {
      setSelected((prev) => (prev.includes(keyword) ? prev.filter((k) => k !== keyword) : [...prev, keyword]));
      return;
    }

    setSelected((prev) => {
      const active = prev.includes(keyword);
      if (active) return prev.filter((item) => item !== keyword);

      const facetKeywordSet = new Set(facet.keywords.map((item) => item.name));
      const currentFacetSelected = prev.filter((item) => facetKeywordSet.has(item));

      if (facet.selectionMode === "single") {
        return [...prev.filter((item) => !facetKeywordSet.has(item)), keyword];
      }

      const maxSelect = facet.maxSelect || facet.keywords.length;
      if (currentFacetSelected.length >= maxSelect) {
        const trimmed = prev.filter((item) => !currentFacetSelected.includes(item));
        return [...trimmed, ...currentFacetSelected.slice(1), keyword];
      }

      return [...prev, keyword];
    });
  };

  const clearSelectedKeywords = () => setSelected([]);

  const handleGeneratePrompt = async () => {
    const semanticKeywords = getSemanticKeywords(groups, selected);
    if (semanticKeywords.length === 0) {
      alert("请至少选择一个主体或画面关键词");
      return;
    }
    if (!loggedIn) {
      alert("请先登录");
      return;
    }
    setLoading(true);
    setStatusText("正在生成提示词...");
    setPrompt("");
    try {
      const structured = semanticKeywords.map((name) => {
        for (const group of groups) {
          const facet = (group.facets || []).find((item) => item.keywords.some((kw) => kw.name === name));
          if (facet) {
            return { name, groupSlug: group.slug, facetSlug: facet.slug };
          }
        }
        return { name, groupSlug: null, facetSlug: null };
      });
      const res = await fetch("/api/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: structured }),
      });
      const data = await res.json();
      if (data.success) {
        setPrompt(data.data.prompt);
      } else {
        alert(data.error || "生成失败");
      }
    } catch {
      alert("生成出错");
    } finally {
      setLoading(false);
      setStatusText("");
    }
  };

  const handleGenerate = async () => {
    if (!loggedIn) {
      alert("请先登录");
      return;
    }

    const body: Record<string, unknown> = { type: mode, size: "1024x1024" };
    const semanticKeywords = getSemanticKeywords(groups, selected);

    if (mode === "video") {
      body.width = videoWidth;
      body.height = videoHeight;
      body.num_frames = videoFrames;
      body.frame_rate = videoFps;
      body.video_mode = videoMode;
    }

    if (mode === "keywords" || mode === "img2img") {
      if (mode === "keywords" && semanticKeywords.length === 0) {
        alert("请至少选择一个主体或画面关键词");
        return;
      }
      if (mode === "img2img" && semanticKeywords.length === 0 && !prompt.trim()) {
        alert("请至少选择关键词或输入编辑指令");
        return;
      }
      body.keywords = semanticKeywords.join(", ");
      body.size = getImageSize(selected);
      if (prompt.trim()) body.prompt = prompt.trim();
    } else if (mode === "manual" || mode === "video") {
      if (!prompt.trim()) {
        alert("请输入提示词");
        return;
      }
      body.keywords = prompt.trim();
      body.prompt = prompt.trim();
    }

    if (mode === "img2img") {
      if (refImages.length === 0) {
        alert("请至少添加一张参考图");
        return;
      }
      body.image = refImages;
    } else if (mode === "video" && videoRefImages.length > 0) {
      if (videoMode === "keyframes" && videoRefImages.length < 2) {
        alert("关键帧动画至少需要两张图片 URL");
        return;
      }
      body.image = videoRefImages;
    }

    setLoading(true);
    setStatusText("正在创建任务...");
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || "创建失败");
        return;
      }
      setLiveTasks((prev) => [
        ...prev,
        {
          id: data.data.taskId,
          status: "pending",
          type: mode,
          keywordNames:
            mode === "keywords"
              ? semanticKeywords.join(", ")
              : mode === "img2img"
                ? semanticKeywords.join(", ") || "参考图编辑"
                : "手动输入",
          prompt: (body.prompt as string) || "",
          imagePath: "",
          videoPath: "",
          posterPath: "",
          progress: 0,
          error: "",
        },
      ]);
      startPolling();
    } catch {
      alert("创建失败");
    } finally {
      setLoading(false);
      setStatusText("");
    }
  };

  const handleDeleteHistory = async (id: number) => {
    if (!confirm("确定删除吗？")) return;
    try {
      await fetch(`/api/history?id=${id}`, { method: "DELETE" });
      fetchHistory();
    } catch {}
  };

  const handleDeleteTask = async (id: number) => {
    try {
      await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
      setLiveTasks((prev) => prev.filter((t) => t.id !== id));
    } catch {}
  };

  const handlePolish = async () => {
    if (!prompt.trim()) {
      alert("请先输入内容");
      return;
    }
    setStatusText("AI 润色中...");
    setLoading(true);
    try {
      const res = await fetch("/api/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: prompt, mode }),
      });
      const data = await res.json();
      if (data.success) setPrompt(data.data.text);
      else alert(data.error || "润色失败");
    } catch {
      alert("润色出错");
    } finally {
      setLoading(false);
      setStatusText("");
    }
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
  const semanticSelected = getSemanticKeywords(groups, selected);
  const outputSelected = getOutputKeywords(groups, selected);
  const outputSize = selected.length > 0 && (mode === "keywords" || mode === "img2img") ? getImageSize(selected) : null;
  const videoDuration = (videoFrames / videoFps).toFixed(1);
  const queueTasks = [...activeTasks, ...failedTasks];
  const workflowGroups = KEYWORD_FLOW.map((item) => {
    const group = groups.find((g) => g.slug === item.slug);
    return {
      ...item,
      facets: group?.facets || [],
      selectedCount: group ? getGroupSelectionCount(group, selected) : 0,
    };
  }).filter((item) => item.slug !== "output" || item.facets.length > 0);

  return (
    <>
      {/* ═══════════ DESKTOP ═══════════ */}
      <div className="hidden min-h-screen lg:block">
        <Header />

        {/* Unauthenticated banner */}
        {!loggedIn && (
          <div className="border-b border-app-border/50 bg-[var(--accent-light)]/30">
            <div className="mx-auto max-w-[1400px] flex items-center justify-between gap-4 px-6 py-2.5 text-sm">
              <span className="text-app-text2">
                当前未登录，无法提交生成任务。请登录后使用 gpt-image 或 Agnes 服务。
              </span>
              <Link
                href="/admin/login"
                className="rounded-md bg-[var(--accent)] px-4 py-1.5 text-xs font-medium text-white transition-base hover:bg-[var(--accent-hover)]"
              >
                去登录
              </Link>
            </div>
          </div>
        )}

        {/* Hero stats bar */}
        <div className="border-b border-app-border/50 bg-[var(--bg-secondary)]/80 backdrop-blur-lg">
          <div className="mx-auto flex max-w-[1400px] items-center gap-6 px-6 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-[10px] uppercase tracking-[0.22em] text-app-text3 shrink-0">
                {MODE_META[mode].eyebrow}
              </span>
              <span className="text-xs font-semibold text-app-text2 truncate">
                {currentMode?.label ?? "关键词导演"}
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5 rounded-md border border-app-border/60 px-2.5 py-1.5">
                <span className="text-[10px] text-app-text3">词</span>
                <span className="text-xs font-mono font-medium tabular-nums text-app-text">
                  {groups.length === 0 ? (
                    <span className="inline-block w-5 h-3 rounded-sm bg-[var(--border)] animate-skeleton align-middle" />
                  ) : (
                    semanticSelected.length
                  )}
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-md border border-app-border/60 px-2.5 py-1.5">
                <span className="text-[10px] text-app-text3">输出</span>
                <span className="text-xs font-mono font-medium tabular-nums text-app-text">
                  {mode === "video" ? `${videoWidth}×${videoHeight}` : outputSize || "1024×1024"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 rounded-md border border-app-border/60 px-2.5 py-1.5">
                <span className="text-[10px] text-app-text3">队列</span>
                <span className="text-xs font-mono font-medium tabular-nums text-app-text">{activeTasks.length}</span>
                {failedTasks.length > 0 && (
                  <span className="text-xs font-mono font-medium tabular-nums text-[var(--danger)]">
                    /{failedTasks.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 rounded-md border border-app-border/60 px-2.5 py-1.5">
                <span className="text-[10px] text-app-text3">成品</span>
                <span className="text-xs font-mono font-medium tabular-nums text-app-text">{records.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main three-column grid */}
        <main className="mx-auto grid max-w-[1400px] grid-cols-12">
          {/* ── LEFT SIDEBAR ── */}
          <aside className="col-span-3 border-r border-app-border/50 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto py-5 pr-5">
            <div className="pl-6 space-y-5">
              <div>
                <h3 className="mb-3 text-[10px] uppercase tracking-[0.22em] text-app-text3">生成模式</h3>
                <div className="space-y-1">
                  {tabs.map((tab) => {
                    const active = tab.key === mode;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => setMode(tab.key)}
                        className="w-full rounded-md px-3 py-2.5 text-left transition-base"
                        style={{
                          background: active ? "var(--accent-light)" : "transparent",
                          borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
                        }}
                      >
                        <div
                          className="text-xs font-medium"
                          style={{ color: active ? "var(--accent)" : "var(--text-secondary)" }}
                        >
                          {tab.label}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-4 text-app-text3">{tab.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <hr className="divider" />

              <div>
                <h3 className="mb-3 text-[10px] uppercase tracking-[0.22em] text-app-text3">输出规格</h3>
                <div className="panel-soft rounded-lg p-3.5">
                  <div className="text-xs font-mono font-medium tabular-nums text-app-text">
                    {mode === "video" ? `${videoWidth}×${videoHeight}` : outputSize || "1024×1024"}
                  </div>
                  <div className="mt-1 text-[11px] text-app-text3">
                    {mode === "video" ? `${videoFrames} 帧 ${videoFps}fps ${videoDuration}s` : `${selected.length} 个参数已选`}
                  </div>
                  <p className="mt-2 text-[11px] leading-4 text-app-text3">
                    {mode === "video"
                      ? "Agnes 约束：(n-1) 可被 8 整除，fps 1-60"
                      : "比例和清晰度仅作为参数，不混入语义 prompt。"}
                  </p>
                </div>
              </div>
            </div>
          </aside>

          {/* ── CENTER ── */}
          <div className="col-span-6 py-4 px-6 space-y-6">
            {/* Workflow steps */}
            <div className="flex items-center gap-0 overflow-x-auto pb-2">
              {workflowGroups.length === 0 ? (
                <div className="flex items-center gap-3">
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <div key={n} className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--border)] animate-skeleton" />
                      <div className="space-y-1">
                        <div className="h-3 w-10 rounded-sm bg-[var(--border)] animate-skeleton" />
                        <div className="h-2 w-16 rounded-sm bg-[var(--border)] animate-skeleton" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                workflowGroups.map((item, index) => (
                  <div key={item.slug} className="flex items-center gap-2 shrink-0">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-base"
                      style={{
                        background: item.selectedCount > 0 ? "var(--accent)" : "var(--bg-tertiary)",
                        color: item.selectedCount > 0 ? "#fff" : "var(--text-muted)",
                      }}
                    >
                      {index + 1}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-app-text leading-tight">{item.name}</div>
                      <div className="text-[10px] text-app-text3 leading-tight">{item.hint}</div>
                    </div>
                    {index < workflowGroups.length - 1 && (
                      <div className="mx-1 h-px w-8 shrink-0 bg-app-border/60" />
                    )}
                  </div>
                ))
              )}
            </div>

            <hr className="divider" />

            {/* Mode-dependent params */}
            {(mode === "keywords" || mode === "img2img") && (
              <div className="space-y-5 animate-fade-in">
                {mode === "img2img" && (
                  <div className="panel-soft rounded-lg p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-xs font-semibold text-app-text">参考图输入</h3>
                        <p className="mt-0.5 text-[11px] text-app-text3">上传底图或粘贴图片 URL / Data URI 进行局部编辑。</p>
                      </div>
                      <span className="rounded-md border border-app-border px-2 py-0.5 text-[10px] text-app-text3">{refImages.length} 张</span>
                    </div>
                    <ImageUploader images={refImages} onChange={setRefImages} />
                  </div>
                )}

                <KeywordSelector
                  groups={groups}
                  selected={selected}
                  onToggle={toggleKeyword}
                  onClear={clearSelectedKeywords}
                />

                {selected.length > 0 && (
                  <div className="panel-soft rounded-lg p-4">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <h3 className="text-xs font-semibold text-app-text">当前画面要素</h3>
                        <p className="mt-0.5 text-[11px] text-app-text3">再次点击标签即可移除对应词条。</p>
                      </div>
                      <button
                        type="button"
                        onClick={clearSelectedKeywords}
                        className="rounded-md border border-app-border px-2.5 py-1 text-[11px] text-app-text3 transition-base hover:border-[var(--border-hover)] hover:text-app-text"
                      >
                        清空全部
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {selected.map((keyword) => (
                        <button
                          key={keyword}
                          type="button"
                          onClick={() => toggleKeyword(keyword)}
                          className="rounded-md border px-2.5 py-1 text-xs transition-base"
                          style={{
                            borderColor: "var(--accent)",
                            background: "var(--accent-light)",
                            color: "var(--accent)",
                          }}
                        >
                          {keyword}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {mode === "video" && (
              <div className="space-y-4 animate-fade-in">
                <div className="panel-soft rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-app-text mb-3">视频模式</h3>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <button
                      type="button"
                      onClick={() => setVideoMode("reference")}
                      className="rounded-md px-3 py-2 text-xs font-medium transition-base"
                      style={{
                        background: videoMode === "reference" ? "var(--accent-light)" : "var(--bg-tertiary)",
                        color: videoMode === "reference" ? "var(--accent)" : "var(--text-secondary)",
                      }}
                    >
                      参考图 / 多图
                    </button>
                    <button
                      type="button"
                      onClick={() => setVideoMode("keyframes")}
                      className="rounded-md px-3 py-2 text-xs font-medium transition-base"
                      style={{
                        background: videoMode === "keyframes" ? "var(--accent-light)" : "var(--bg-tertiary)",
                        color: videoMode === "keyframes" ? "var(--accent)" : "var(--text-secondary)",
                      }}
                    >
                      关键帧动画
                    </button>
                  </div>

                  <div className="mb-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="text-[11px] text-app-text3">参考图 URL</h4>
                      <span className="text-[10px] text-app-text3">{videoRefImages.length} 条</span>
                    </div>
                    <ImageUploader
                      images={videoRefImages}
                      onChange={setVideoRefImages}
                      allowUpload={false}
                      allowDataUri={false}
                      hint="视频参考图仅支持公网 URL"
                    />
                    <p className="mt-2 text-[11px] leading-4 text-app-text3">
                      {videoRefImages.length === 0
                        ? "不添加参考图时，直接按文本生成视频。"
                        : videoMode === "keyframes"
                          ? "关键帧至少两张图，建议风格和主体保持连续。"
                          : "多图可稳定主体造型、色调和镜头氛围。"}
                    </p>
                  </div>

                  <h4 className="text-[11px] text-app-text3 mb-2">输出规格</h4>
                  <div className="grid grid-cols-4 gap-2">
                    <label className="block">
                      <span className="text-[10px] text-app-text3">宽</span>
                      <select
                        value={videoWidth}
                        onChange={(e) => setVideoWidth(Number(e.target.value))}
                        className="mt-1 w-full rounded-md border border-app-border bg-[var(--bg-tertiary)] px-2 py-1.5 text-xs text-app-text focus:border-[var(--border-hover)] focus:outline-none"
                      >
                        <option value={768}>768</option>
                        <option value={1080}>1080</option>
                        <option value={1152}>1152</option>
                        <option value={1920}>1920</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-app-text3">高</span>
                      <select
                        value={videoHeight}
                        onChange={(e) => setVideoHeight(Number(e.target.value))}
                        className="mt-1 w-full rounded-md border border-app-border bg-[var(--bg-tertiary)] px-2 py-1.5 text-xs text-app-text focus:border-[var(--border-hover)] focus:outline-none"
                      >
                        <option value={576}>576</option>
                        <option value={768}>768</option>
                        <option value={1080}>1080</option>
                        <option value={1152}>1152</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-app-text3">帧数</span>
                      <select
                        value={videoFrames}
                        onChange={(e) => setVideoFrames(Number(e.target.value))}
                        className="mt-1 w-full rounded-md border border-app-border bg-[var(--bg-tertiary)] px-2 py-1.5 text-xs text-app-text focus:border-[var(--border-hover)] focus:outline-none"
                      >
                        <option value={81}>81</option>
                        <option value={121}>121</option>
                        <option value={201}>201</option>
                        <option value={401}>401</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[10px] text-app-text3">fps</span>
                      <select
                        value={videoFps}
                        onChange={(e) => setVideoFps(Number(e.target.value))}
                        className="mt-1 w-full rounded-md border border-app-border bg-[var(--bg-tertiary)] px-2 py-1.5 text-xs text-app-text focus:border-[var(--border-hover)] focus:outline-none"
                      >
                        <option value={8}>8</option>
                        <option value={16}>16</option>
                        <option value={24}>24</option>
                        <option value={30}>30</option>
                      </select>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Prompt Console */}
            <div className="panel-soft rounded-lg p-0.5 transition-base focus-within:accent-ring">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={mode === "video" ? 10 : 8}
                className="w-full min-h-[12rem] rounded-[7px] border-0 bg-transparent px-4 py-4 text-sm leading-7 text-app-text placeholder:text-app-text3 resize-none focus:outline-none"
                placeholder={
                  mode === "video"
                    ? "描述画面主体动作、镜头运动、光线变化和景别切换..."
                    : mode === "img2img"
                      ? "描述保留什么、改动什么，例如：保持脸部不变，只替换服装和环境..."
                      : mode === "manual"
                        ? "直接输入完整提示词..."
                        : "先选择关键词，然后点击「生成提示词」自动生成底稿，或直接手写..."
                }
              />

              <div className="flex items-center justify-between gap-3 border-t border-app-border/60 px-4 py-3">
                <div className="flex items-center gap-3 text-[11px] text-app-text3">
                  <span className="font-mono tabular-nums">{prompt.length} 字符</span>
                  <span className="text-app-border">|</span>
                  <span className="font-mono">
                    {mode === "video" ? `${videoWidth}×${videoHeight} / ${videoDuration}s` : outputSize || "1024×1024"}
                  </span>
                  <span className="text-app-border">|</span>
                  <span style={{ color: loggedIn ? "var(--success)" : "var(--text-muted)" }}>
                    {loggedIn ? "已登录" : "未登录"}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {mode === "keywords" && (
                    <button
                      onClick={handleGeneratePrompt}
                      disabled={loading || selected.length === 0 || !loggedIn}
                      className="rounded-md border border-app-border px-3 py-1.5 text-xs font-medium text-app-text2 transition-base hover:border-[var(--border-hover)] hover:text-app-text disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {loading && statusText === "正在生成提示词..." ? "生成中..." : "生成提示词"}
                    </button>
                  )}
                  <button
                    onClick={handlePolish}
                    disabled={loading || !prompt.trim()}
                    className="rounded-md border border-app-border px-3 py-1.5 text-xs font-medium text-app-text2 transition-base hover:border-[var(--border-hover)] hover:text-app-text disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading && statusText === "AI 润色中..." ? "润色中..." : "AI 润色"}
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={loading || !loggedIn || (!prompt.trim() && mode !== "img2img")}
                    className="rounded-md bg-[var(--accent)] px-5 py-1.5 text-xs font-semibold text-white transition-base hover:bg-[var(--accent-hover)] hover:shadow-[0_0_16px_var(--accent-glow)] disabled:bg-[var(--bg-tertiary)] disabled:text-app-text3 disabled:shadow-none disabled:cursor-not-allowed"
                  >
                    {!loggedIn
                      ? "请先登录"
                      : loading && statusText !== "AI 润色中..." && statusText !== "正在生成提示词..."
                        ? statusText
                        : mode === "video"
                          ? "提交视频任务"
                          : "提交图片任务"}
                  </button>
                </div>
              </div>
            </div>

            {/* Gallery */}
            <div>
              <MasonryGallery
                records={records}
                liveTasks={[]}
                onDelete={handleDeleteHistory}
                onDeleteTask={handleDeleteTask}
              />
            </div>
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <aside className="col-span-3 border-l border-app-border/50 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto py-5 pl-5">
            <div className="pr-6 space-y-4">
              <h3 className="text-[10px] uppercase tracking-[0.22em] text-app-text3">任务队列</h3>

              <div className="grid grid-cols-3 gap-2">
                <div className="panel-soft rounded-md px-2.5 py-3 text-center">
                  <div className="text-sm font-mono font-semibold tabular-nums text-app-text">{activeTasks.length}</div>
                  <div className="text-[10px] text-app-text3 mt-0.5">进行中</div>
                </div>
                <div className="panel-soft rounded-md px-2.5 py-3 text-center">
                  <div className="text-sm font-mono font-semibold tabular-nums text-app-text">{failedTasks.length}</div>
                  <div className="text-[10px] text-app-text3 mt-0.5">失败</div>
                </div>
                <div className="panel-soft rounded-md px-2.5 py-3 text-center">
                  <div className="text-sm font-mono font-semibold tabular-nums text-app-text">{records.length}</div>
                  <div className="text-[10px] text-app-text3 mt-0.5">成品</div>
                </div>
              </div>

              {queueTasks.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-xs text-app-text3">当前没有排队任务</p>
                  <p className="mt-1 text-[11px] text-app-text3/60">提交生成后将在此处跟踪进度</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {queueTasks.map((task) => (
                    <div key={task.id} className="panel-soft rounded-lg p-3.5 space-y-2.5 animate-fade-in">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="rounded-sm px-1.5 py-0.5 text-[10px] font-medium"
                            style={{
                              background: task.type === "video" ? "var(--accent-light)" : "var(--success-bg)",
                              color: task.type === "video" ? "var(--accent)" : "var(--success)",
                            }}
                          >
                            {task.type === "video" ? "视频" : "图片"}
                          </span>
                          <span className="text-[10px] text-app-text3">#{task.id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px]"
                            style={{
                              color: task.status === "failed" ? "var(--danger)" : task.status === "processing" ? "var(--accent)" : "var(--text-muted)",
                            }}
                          >
                            {task.status === "failed" ? "失败" : task.status === "processing" ? "处理中" : "排队中"}
                          </span>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            className="text-[10px] text-app-text3 transition-base hover:text-[var(--danger)]"
                          >
                            删除
                          </button>
                        </div>
                      </div>

                      <p className="text-xs leading-5 text-app-text2 line-clamp-2">{task.prompt || task.keywordNames || "等待处理"}</p>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] text-app-text3">
                          <span>{task.progress || 0}%</span>
                          {task.status === "failed" && <span>任务失败</span>}
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-tertiary)]">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(4, Math.min(100, task.progress || (task.status === "failed" ? 100 : 8)))}%`,
                              background: task.status === "failed" ? "var(--danger)" : "var(--accent)",
                            }}
                          />
                        </div>
                      </div>

                      {task.error && (
                        <p className="text-[11px] leading-4 text-[var(--danger)]">{task.error}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </main>
      </div>

      {/* ═══════════ MOBILE ═══════════ */}
      <div className="lg:hidden">
        <MobileHome
          loggedIn={loggedIn}
          groups={groups}
          selected={selected}
          onToggleKeyword={toggleKeyword}
          onClearKeywords={clearSelectedKeywords}
          prompt={prompt}
          onPromptChange={setPrompt}
          loading={loading}
          statusText={statusText}
          mode={mode}
          onModeChange={setMode}
          records={records}
          liveTasks={liveTasks}
          onGeneratePrompt={handleGeneratePrompt}
          onGenerate={handleGenerate}
          onPolish={handlePolish}
          onDeleteHistory={handleDeleteHistory}
          onDeleteTask={handleDeleteTask}
          refImages={refImages}
          onRefImagesChange={setRefImages}
          videoRefImages={videoRefImages}
          onVideoRefImagesChange={setVideoRefImages}
          videoMode={videoMode}
          onVideoModeChange={setVideoMode}
          videoWidth={videoWidth}
          onVideoWidthChange={setVideoWidth}
          videoHeight={videoHeight}
          onVideoHeightChange={setVideoHeight}
          videoFrames={videoFrames}
          onVideoFramesChange={setVideoFrames}
          videoFps={videoFps}
          onVideoFpsChange={setVideoFps}
          outputSize={outputSize}
          videoDuration={videoDuration}
        />
      </div>
    </>
  );
}
