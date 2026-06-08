"use client";

import { useState } from "react";
import { ImageRecord } from "@/types";
import ImageCard from "./ImageCard";
import TaskCard from "./TaskCard";

interface TaskRecord {
  id: number; status: string; type: string;
  keywordNames: string; prompt: string;
  imagePath: string; videoPath: string; posterPath: string; progress: number; error: string;
}

type SortOrder = "newest" | "oldest";
type FilterType = "all" | "image" | "video";

interface Props {
  records: ImageRecord[];
  liveTasks: TaskRecord[];
  onDelete: (id: number) => void;
  onDeleteTask: (id: number) => void;
  onImageClick?: (record: ImageRecord) => void;
}

function isVideo(record: ImageRecord) { return record.type === "video" || /\.(mp4|webm|mov)$/i.test(record.imagePath); }

export default function MasonryGallery({ records, liveTasks, onDelete, onDeleteTask, onImageClick }: Props) {
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [filterType, setFilterType] = useState<FilterType>("all");

  const filtered = records.filter((r) => {
    if (filterType === "image") return !isVideo(r);
    if (filterType === "video") return isVideo(r);
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return sortOrder === "newest" ? tb - ta : ta - tb;
  });

  const imageCount = records.filter((r) => !isVideo(r)).length;
  const videoCount = records.filter((r) => isVideo(r)).length;

  if (records.length === 0 && liveTasks.length === 0) {
    return (
      <div className="rounded-[1.7rem] border border-dashed border-app-border bg-app-bg px-6 py-20 text-center" style={{ color: "var(--text-muted)" }}>
        <p className="text-base sm:text-lg text-app-text">暂时还没有生成结果</p>
        <p className="mt-2 text-sm opacity-70">从左侧先选主体、环境和镜头，再生成第一批样张。</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-full border border-app-border bg-app-bg p-1">
          {([
            ["all", `全部 ${records.length}`],
            ["image", `图片 ${imageCount}`],
            ["video", `视频 ${videoCount}`],
          ] as [FilterType, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className="rounded-full px-3 py-1.5 text-xs font-medium transition"
              style={{
                background: filterType === key ? "var(--accent)" : "transparent",
                color: filterType === key ? "#fff" : "var(--text-secondary)",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setSortOrder((o) => (o === "newest" ? "oldest" : "newest"))}
          className="flex items-center gap-1 rounded-full border border-app-border px-3 py-1.5 text-xs font-medium transition hover:border-[var(--border-hover)]"
          style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: sortOrder === "oldest" ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
          {sortOrder === "newest" ? "最新优先" : "最早优先"}
        </button>
      </div>

      <div className="columns-1 xs:columns-2 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-4 sm:gap-5">
        {liveTasks.map((task) => (
          <TaskCard key={`task-${task.id}`} task={task} onDelete={onDeleteTask} />
        ))}
        {sorted.map((record) => (
            <ImageCard key={record.id} record={record} onDelete={onDelete} onImageClick={onImageClick} />
        ))}
      </div>
    </div>
  );
}
