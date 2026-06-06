"use client";

import { ImageRecord } from "@/types";
import ImageCard from "./ImageCard";
import TaskCard from "./TaskCard";

interface TaskRecord {
  id: number;
  status: string;
  keywordNames: string;
  prompt: string;
  imagePath: string;
  error: string;
}

interface Props {
  records: ImageRecord[];
  liveTasks: TaskRecord[];
  onDelete: (id: number) => void;
  onDeleteTask: (id: number) => void;
}

export default function MasonryGallery({ records, liveTasks, onDelete, onDeleteTask }: Props) {
  if (records.length === 0 && liveTasks.length === 0) {
    return (
      <div className="text-center py-16 sm:py-20" style={{ color: "var(--text-muted)" }}>
        <p className="text-sm sm:text-base">暂无生成的图片</p>
        <p className="text-xs mt-1 opacity-60">选择关键词后生成提示词，再点击生成图片即可开始</p>
      </div>
    );
  }

  return (
    <div className="columns-1 xs:columns-2 sm:columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-3 sm:gap-4">
      {liveTasks.map((task) => (
        <TaskCard key={`task-${task.id}`} task={task} onDelete={onDeleteTask} />
      ))}
      {records.map((record) => (
        <ImageCard key={record.id} record={record} onDelete={onDelete} />
      ))}
    </div>
  );
}
