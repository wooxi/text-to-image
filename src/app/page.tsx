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
      <div className="hidden min-h-screen lg:block">
        <Header />

        <main className="mx-auto flex max-w-[124rem] flex-col gap-6 px-4 pb-10 pt-6 sm:px-6 xl:px-8">
          {!loggedIn && (
            <div className="glass-panel rounded-[2rem] px-5 py-4 text-sm text-[var(--accent)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.22em] text-app-text3">Access</div>
                  <p className="mt-1 text-sm text-app-text">当前未登录，无法提交生成任务。登录后才能调用 `gpt-image` 或 Agnes 服务。</p>
                </div>
                <Link href="/admin/login" className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]">
                  去登录
                </Link>
              </div>
            </div>
          )}

          <section className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
            <div className="glass-panel relative overflow-hidden rounded-[2rem] p-7 xl:p-8">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(217,107,43,0.14),_transparent_28%),radial-gradient(circle_at_left_center,_rgba(136,192,168,0.12),_transparent_30%)]" />
              <div className="relative flex h-full flex-col justify-between gap-8">
                <div className="max-w-3xl">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-app-text3">{MODE_META[mode].eyebrow}</div>
                  <h1 className="mt-3 text-3xl font-semibold leading-tight text-app-text xl:text-5xl">
                    先定义主体和镜头，再决定模型如何生成这张图。
                  </h1>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-app-text2 xl:text-base">
                    关键词系统已经按主体、环境、穿着、姿势、镜头、风格重新拆分。输出比例和清晰度独立处理，避免语义词和参数词混杂。当前兼容 OpenAI `gpt-image-1`，也适配 Agnes 图像和视频参数约束。
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <div className="panel-soft rounded-[1.5rem] p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-app-text3">Mode</div>
                    <div className="mt-2 text-2xl font-semibold text-app-text">{currentMode?.label}</div>
                    <p className="mt-2 text-xs leading-6 text-app-text3">{MODE_META[mode].desc}</p>
                  </div>
                  <div className="panel-soft rounded-[1.5rem] p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-app-text3">Semantic</div>
                    <div className="mt-2 text-2xl font-semibold text-app-text">{semanticSelected.length}</div>
                    <p className="mt-2 text-xs leading-6 text-app-text3">已选画面语义词，建议控制在 4 到 8 个核心描述。</p>
                  </div>
                  <div className="panel-soft rounded-[1.5rem] p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-app-text3">Output</div>
                    <div className="mt-2 text-2xl font-semibold text-app-text">{mode === "video" ? `${videoWidth}×${videoHeight}` : outputSize || "1024×1024"}</div>
                    <p className="mt-2 text-xs leading-6 text-app-text3">{mode === "video" ? `${videoFrames} 帧 / ${videoFps}fps / ${videoDuration}s` : `${outputSelected.length} 个输出参数已生效`}</p>
                  </div>
                  <div className="panel-soft rounded-[1.5rem] p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-app-text3">Queue</div>
                    <div className="mt-2 text-2xl font-semibold text-app-text">{activeTasks.length}</div>
                    <p className="mt-2 text-xs leading-6 text-app-text3">进行中 {activeTasks.length}，失败 {failedTasks.length}，图库累计 {records.length} 项。</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-[2rem] p-6 xl:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-app-text3">Workflow</div>
                  <h2 className="mt-2 text-2xl font-semibold text-app-text">关键词流程</h2>
                </div>
                <span className="rounded-full border border-app-border px-3 py-1 text-xs text-app-text3">{groups.length} 组分类</span>
              </div>
              <div className="mt-6 space-y-3">
                {workflowGroups.map((item, index) => (
                  <div key={item.slug} className="panel-soft rounded-[1.35rem] px-4 py-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--accent-light)] text-sm font-semibold text-[var(--accent)]">
                        {index + 1}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-app-text">{item.name}</h3>
                            <p className="mt-1 text-xs leading-6 text-app-text3">{item.hint}</p>
                          </div>
                          <span className="rounded-full border border-app-border px-2.5 py-1 text-[11px] text-app-text3">{item.selectedCount} 已选</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(item.facets.length > 0 ? item.facets : []).slice(0, 4).map((facet) => (
                            <span key={facet.slug} className="rounded-full bg-app-bg px-3 py-1 text-xs text-app-text2">
                              {facet.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid items-start gap-6 xl:grid-cols-[19rem_minmax(0,1fr)_22rem]">
            <aside className="glass-panel sticky top-24 rounded-[2rem] p-5">
              <div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-app-text3">Generate Mode</div>
                <h2 className="mt-2 text-xl font-semibold text-app-text">创作入口</h2>
              </div>
              <div className="mt-5 space-y-3">
                {tabs.map((tab) => {
                  const active = tab.key === mode;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setMode(tab.key)}
                      className="w-full rounded-[1.35rem] border px-4 py-4 text-left transition"
                      style={{
                        borderColor: active ? "var(--accent)" : "var(--border)",
                        background: active ? "var(--accent-light)" : "var(--bg-secondary)",
                        boxShadow: active ? "0 0 0 1px var(--accent-light) inset" : "none",
                      }}
                    >
                      <div className="text-sm font-semibold" style={{ color: active ? "var(--accent)" : "var(--text-primary)" }}>
                        {tab.label}
                      </div>
                      <p className="mt-1 text-xs leading-6 text-app-text3">{tab.desc}</p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 rounded-[1.4rem] border border-app-border bg-app-bg px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-app-text3">Current Output</div>
                    <div className="mt-2 text-lg font-semibold text-app-text">{mode === "video" ? `${videoWidth}×${videoHeight}` : outputSize || "1024×1024"}</div>
                  </div>
                  <span className="rounded-full bg-[var(--accent-light)] px-3 py-1 text-xs text-[var(--accent)]">
                    {mode === "video" ? `${videoDuration}s` : `${selected.length} 词`}
                  </span>
                </div>
                <p className="mt-3 text-xs leading-6 text-app-text3">
                  {mode === "video"
                    ? "Agnes 视频要求帧数满足 (n-1) 可被 8 整除，页面已按这一规则限制。"
                    : "比例和清晰度词只作为参数提交，不混入自然语言提示词。"}
                </p>
              </div>
            </aside>

            <section className="space-y-6">
              {(mode === "keywords" || mode === "img2img") && (
                <section className="glass-panel overflow-hidden rounded-[2rem]">
                  <div className="flex items-start justify-between gap-4 border-b border-app-border px-6 py-5">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-app-text3">Keyword System</div>
                      <h2 className="mt-2 text-2xl font-semibold text-app-text">结构化选词</h2>
                      <p className="mt-2 text-sm leading-7 text-app-text2">按创作顺序完成画面定义，避免旧版标签体系杂乱堆叠。</p>
                    </div>
                    <div className="rounded-[1.1rem] border border-app-border bg-app-bg px-4 py-3 text-right">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-app-text3">Selected</div>
                      <div className="mt-2 text-xl font-semibold text-app-text">{semanticSelected.length}</div>
                      <div className="text-xs text-app-text3">语义词 / {selected.length} 总计</div>
                    </div>
                  </div>

                  <div className="space-y-6 px-6 py-6">
                    {mode === "img2img" && (
                      <div className="rounded-[1.5rem] border border-app-border bg-app-bg px-5 py-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-app-text">参考图输入</h3>
                            <p className="mt-1 text-xs leading-6 text-app-text3">上传底图，或直接粘贴图片 URL / Data URI 做局部改造。</p>
                          </div>
                          <span className="rounded-full border border-app-border px-3 py-1 text-xs text-app-text3">{refImages.length} 张</span>
                        </div>
                        <ImageUploader images={refImages} onChange={setRefImages} />
                      </div>
                    )}

                    <KeywordSelector groups={groups} selected={selected} onToggle={toggleKeyword} onClear={clearSelectedKeywords} />

                    {selected.length > 0 && (
                      <div className="rounded-[1.5rem] border border-app-border bg-app-bg px-5 py-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-sm font-semibold text-app-text">当前画面要素</h3>
                            <p className="mt-1 text-xs leading-6 text-app-text3">保留这些词作为当前构图基础。再次点击即可移除。</p>
                          </div>
                          <button
                            type="button"
                            onClick={clearSelectedKeywords}
                            className="rounded-full border border-app-border px-3 py-1.5 text-xs text-app-text2 transition hover:border-[var(--border-hover)] hover:text-app-text"
                          >
                            清空
                          </button>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          {selected.map((keyword) => (
                            <button
                              key={keyword}
                              type="button"
                              onClick={() => toggleKeyword(keyword)}
                              className="rounded-full border border-[var(--accent)] bg-[var(--accent-light)] px-3 py-2 text-xs text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-white"
                            >
                              {keyword}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {mode === "video" && (
                <section className="glass-panel overflow-hidden rounded-[2rem]">
                  <div className="flex items-start justify-between gap-4 border-b border-app-border px-6 py-5">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-app-text3">Video Pipeline</div>
                      <h2 className="mt-2 text-2xl font-semibold text-app-text">视频参数控制</h2>
                      <p className="mt-2 text-sm leading-7 text-app-text2">适配 Agnes 视频生成，兼容纯文本、参考图和关键帧工作流。</p>
                    </div>
                    <span className="rounded-full bg-[var(--accent-light)] px-4 py-2 text-sm font-medium text-[var(--accent)]">约 {videoDuration} 秒</span>
                  </div>

                  <div className="grid gap-6 px-6 py-6 xl:grid-cols-[0.95fr_1.05fr]">
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-3 rounded-[1.35rem] border border-app-border bg-app-bg p-1.5">
                        {([
                          ["reference", "参考图 / 多图"],
                          ["keyframes", "关键帧动画"],
                        ] as ["reference" | "keyframes", string][]).map(([key, label]) => (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setVideoMode(key)}
                            className="rounded-[1rem] px-4 py-3 text-sm font-semibold transition"
                            style={{
                              background: videoMode === key ? "var(--accent-light)" : "transparent",
                              color: videoMode === key ? "var(--accent)" : "var(--text-secondary)",
                            }}
                          >
                            {label}
                          </button>
                        ))}
                      </div>

                      <div className="rounded-[1.5rem] border border-app-border bg-app-bg px-5 py-5">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-sm font-semibold text-app-text">参考图 URL</h3>
                            <p className="mt-1 text-xs leading-6 text-app-text3">视频模式只接受公网 URL，不走本地上传。</p>
                          </div>
                          <span className="rounded-full border border-app-border px-3 py-1 text-xs text-app-text3">{videoRefImages.length} 条</span>
                        </div>
                        <ImageUploader images={videoRefImages} onChange={setVideoRefImages} allowUpload={false} allowDataUri={false} hint="视频参考图仅支持公网 URL" />
                        <p className="mt-3 text-xs leading-6 text-app-text3">
                          {videoRefImages.length === 0
                            ? "不添加参考图时，直接按文本生成视频。"
                            : videoMode === "keyframes"
                              ? "关键帧至少两张图，建议风格和主体保持连续。"
                              : "多图可稳定主体造型、色调和镜头氛围。"}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-app-border bg-app-bg px-5 py-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-semibold text-app-text">输出规格</h3>
                          <p className="mt-1 text-xs leading-6 text-app-text3">当前参数满足 Agnes 的帧数和帧率范围要求。</p>
                        </div>
                        <span className="rounded-full border border-app-border px-3 py-1 text-xs text-app-text3">{videoWidth}×{videoHeight}</span>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-4">
                        <label className="block text-xs text-app-text3">
                          宽度
                          <select value={videoWidth} onChange={(e) => setVideoWidth(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-app-border bg-app-bg2 px-3 py-3 text-sm text-app-text focus:border-[var(--border-hover)] focus:outline-none">
                            <option value={768}>768</option>
                            <option value={1080}>1080</option>
                            <option value={1152}>1152</option>
                            <option value={1920}>1920</option>
                          </select>
                        </label>
                        <label className="block text-xs text-app-text3">
                          高度
                          <select value={videoHeight} onChange={(e) => setVideoHeight(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-app-border bg-app-bg2 px-3 py-3 text-sm text-app-text focus:border-[var(--border-hover)] focus:outline-none">
                            <option value={576}>576</option>
                            <option value={768}>768</option>
                            <option value={1080}>1080</option>
                            <option value={1152}>1152</option>
                          </select>
                        </label>
                        <label className="block text-xs text-app-text3">
                          帧数
                          <select value={videoFrames} onChange={(e) => setVideoFrames(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-app-border bg-app-bg2 px-3 py-3 text-sm text-app-text focus:border-[var(--border-hover)] focus:outline-none">
                            <option value={81}>81 (3.4s)</option>
                            <option value={121}>121 (5s)</option>
                            <option value={201}>201 (8.4s)</option>
                            <option value={401}>401 (16.7s)</option>
                          </select>
                        </label>
                        <label className="block text-xs text-app-text3">
                          帧率
                          <select value={videoFps} onChange={(e) => setVideoFps(Number(e.target.value))} className="mt-2 w-full rounded-xl border border-app-border bg-app-bg2 px-3 py-3 text-sm text-app-text focus:border-[var(--border-hover)] focus:outline-none">
                            <option value={8}>8 fps</option>
                            <option value={16}>16 fps</option>
                            <option value={24}>24 fps</option>
                            <option value={30}>30 fps</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <section className="glass-panel overflow-hidden rounded-[2rem] accent-ring">
                <div className="flex items-start justify-between gap-4 border-b border-app-border px-6 py-5">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-app-text3">Prompt Console</div>
                    <h2 className="mt-2 text-2xl font-semibold text-app-text">
                      {mode === "video" ? "画面与镜头脚本" : mode === "img2img" ? "编辑指令台" : "提示词控制台"}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-app-text2">
                      {mode === "keywords"
                        ? "先让系统按结构化关键词生成底稿，再手动微调语气、镜头和细节。"
                        : MODE_META[mode].desc}
                    </p>
                  </div>
                  <div className="rounded-[1.1rem] border border-app-border bg-app-bg px-4 py-3 text-right">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-app-text3">Characters</div>
                    <div className="mt-2 text-xl font-semibold text-app-text">{prompt.length}</div>
                    <div className="text-xs text-app-text3">当前文本长度</div>
                  </div>
                </div>

                <div className="px-6 py-6">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={mode === "video" ? 12 : 10}
                    className="min-h-[20rem] w-full rounded-[1.7rem] border border-app-border bg-app-bg px-5 py-5 text-base leading-8 text-app-text placeholder:text-app-text3 focus:border-[var(--border-hover)] focus:outline-none"
                    placeholder={mode === "video" ? "描述主体动作、镜头运动、光线变化、景别切换和结尾状态..." : mode === "img2img" ? "描述保留什么、改动什么，例如脸部不变，只替换服装和环境..." : "输入完整提示词，或先从关键词自动生成..."}
                  />

                  <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-app-text3">
                    <span className="rounded-full border border-app-border px-3 py-1.5">{prompt.length} 字符</span>
                    <span className="rounded-full border border-app-border px-3 py-1.5">{mode === "video" ? `${videoWidth}×${videoHeight} / ${videoDuration}s` : outputSize || "默认 1024×1024"}</span>
                    <span className="rounded-full border border-app-border px-3 py-1.5">{loggedIn ? "已登录，可直接提交" : "未登录，仅可浏览"}</span>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    {mode === "keywords" && (
                      <button
                        onClick={handleGeneratePrompt}
                        disabled={loading || selected.length === 0 || !loggedIn}
                        className="rounded-full border border-app-border bg-app-bg2 px-5 py-3 text-sm font-medium text-app-text2 transition hover:border-[var(--border-hover)] hover:text-app-text disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {loading && statusText === "正在生成提示词..." ? "正在生成提示词" : "生成提示词底稿"}
                      </button>
                    )}
                    <button
                      onClick={handlePolish}
                      disabled={loading || !prompt.trim()}
                      className="rounded-full border border-app-border bg-app-bg2 px-5 py-3 text-sm font-medium text-app-text2 transition hover:border-[var(--border-hover)] hover:text-app-text disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {loading && statusText === "AI 润色中..." ? "润色中" : "AI 润色"}
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={loading || !loggedIn || (!prompt.trim() && mode !== "img2img")}
                      className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:bg-app-bg2 disabled:text-app-text3"
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
              </section>

              <section className="glass-panel rounded-[2rem] px-6 py-6">
                <div className="flex items-end justify-between gap-4 border-b border-app-border pb-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-app-text3">Gallery</div>
                    <h2 className="mt-2 text-2xl font-semibold text-app-text">生成结果</h2>
                    <p className="mt-1 text-sm text-app-text3">桌面端支持更宽的瀑布流预览，便于筛图和对比。</p>
                  </div>
                  <span className="rounded-full border border-app-border px-3 py-1.5 text-xs text-app-text3">{records.length} 个作品</span>
                </div>
                <div className="mt-5">
                  <MasonryGallery records={records} liveTasks={[]} onDelete={handleDeleteHistory} onDeleteTask={handleDeleteTask} />
                </div>
              </section>
            </section>

            <aside className="glass-panel sticky top-24 overflow-hidden rounded-[2rem]">
              <div className="border-b border-app-border px-5 py-5">
                <div className="text-[11px] uppercase tracking-[0.22em] text-app-text3">Task Queue</div>
                <h2 className="mt-2 text-xl font-semibold text-app-text">任务队列</h2>
                <p className="mt-1 text-sm text-app-text3">正在提交和失败的任务会在这里跟踪。</p>
              </div>

              <div className="border-b border-app-border px-5 py-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-[1rem] bg-app-bg px-3 py-3">
                    <div className="text-lg font-semibold text-app-text">{activeTasks.length}</div>
                    <div className="text-[11px] text-app-text3">进行中</div>
                  </div>
                  <div className="rounded-[1rem] bg-app-bg px-3 py-3">
                    <div className="text-lg font-semibold text-app-text">{failedTasks.length}</div>
                    <div className="text-[11px] text-app-text3">失败</div>
                  </div>
                  <div className="rounded-[1rem] bg-app-bg px-3 py-3">
                    <div className="text-lg font-semibold text-app-text">{records.length}</div>
                    <div className="text-[11px] text-app-text3">成品</div>
                  </div>
                </div>
              </div>

              {queueTasks.length === 0 ? (
                <div className="px-5 py-14 text-center text-sm text-app-text3">当前没有排队任务。</div>
              ) : (
                <div className="max-h-[calc(100vh-18rem)] overflow-y-auto px-4 py-4">
                  <div className="space-y-3">
                    {queueTasks.map((task) => (
                      <div key={task.id} className="rounded-[1.4rem] border border-app-border bg-app-bg px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[11px] uppercase tracking-[0.16em] text-app-text3">Task #{task.id}</span>
                          <button onClick={() => handleDeleteTask(task.id)} className="text-xs text-app-text3 transition hover:text-app-text">
                            删除
                          </button>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="rounded-full bg-[var(--accent-light)] px-2.5 py-1 text-[11px] text-[var(--accent)]">
                            {task.type === "video" ? "视频" : "图片"}
                          </span>
                          <span className="rounded-full border border-app-border px-2.5 py-1 text-[11px] text-app-text3">
                            {task.status === "failed" ? "失败" : task.status === "processing" ? "处理中" : "排队中"}
                          </span>
                        </div>
                        <p className="mt-3 line-clamp-3 text-sm leading-6 text-app-text2">{task.prompt || task.keywordNames || "等待处理"}</p>
                        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-app-text3">
                          <span>{task.progress || 0}%</span>
                          <span>{task.status === "failed" ? "需要检查配置或参数" : "任务状态正常轮询中"}</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-app-bg2">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(6, Math.min(100, task.progress || (task.status === "failed" ? 100 : 10)))}%`,
                              background: task.status === "failed" ? "var(--danger)" : "var(--accent)",
                            }}
                          />
                        </div>
                        {task.error && <p className="mt-3 text-xs leading-6 text-red-400">{task.error}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </section>
        </main>
      </div>

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
