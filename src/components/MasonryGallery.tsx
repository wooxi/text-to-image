"use client";

import { useState } from "react";
import { ImageRecord } from "@/types";
import ImageCard from "./ImageCard";
import TaskCard from "./TaskCard";

interface TaskRecord {
  id: number; status: string; type: string;
  keywordNames: string; prompt: string;
  imagePath: string; videoPath: string; posterPath: string; error: string;
}

type SortOrder = "newest" | "oldest";
type FilterType = "all" | "image" | "video";

interface Props {
  records: ImageRecord[];
  liveTasks: TaskRecord[];
  onDelete: (id: number) => void;
  onDeleteTask: (id: number) => void;
}

function isVideo(path: string) { return /\.(mp4|webm|mov)$/i.test(path); }

export default function MasonryGallery({ records, liveTasks, onDelete, onDeleteTask }: Props) {
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [filterType, setFilterType] = useState<FilterType>("all");

  const filtered = records.filter((r) => {
    if (filterType === "image") return !isVideo(r.imagePath);
    if (filterType === "video") return isVideo(r.imagePath);
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const ta = new Date(a.createdAt).getTime();
    const tb = new Date(b.createdAt).getTime();
    return sortOrder === "newest" ? tb - ta : ta - tb;
  });

  const imageCount = records.filter((r) => !isVideo(r.imagePath)).length;
  const videoCount = records.filter((r) => isVideo(r.imagePath)).length;

  if (records.length === 0 && liveTasks.length === 0) {
    return (
      <div className="text-center py-16 sm:py-20" style={{ color: "var(--text-muted)" }}>
        <p className="text-sm sm:text-base">暂无生成的图片</p>
        <p className="text-xs mt-1 opacity-60">选择关键词生成提示词，再点击生成图片即可开始</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex gap-1 bg-[var(--bg-tertiary)] rounded-lg p-1">
          {([
            ["all", `全部 ${records.length}`],
            ["image", `图片 ${imageCount}`],
            ["video", `视频 ${videoCount}`],
          ] as [FilterType, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition"
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
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition"
          style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: sortOrder === "oldest" ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
            <path d="M12 5v14M5 12l7-7 7 7" />
          </svg>
          {sortOrder === "newest" ? "最新优先" : "最早优先"}
        </button>
      </div>

      <div className="columns-1 xs:columns-2 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3 sm:gap-4">
        {liveTasks.map((task) => (
          <TaskCard key={`task-${task.id}`} task={task} onDelete={onDeleteTask} />
        ))}
        {sorted.map((record) => (
          <ImageCard key={record.id} record={record} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
}
