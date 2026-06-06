"use client";

interface TaskRecord {
  id: number;
  status: string;
  keywordNames: string;
  prompt: string;
  imagePath: string;
  error: string;
}

interface Props {
  task: TaskRecord;
  onDelete: (id: number) => void;
}

export default function TaskCard({ task, onDelete }: Props) {
  const isFailed = task.status === "failed";
  const isProcessing = task.status === "pending" || task.status === "processing";

  return (
    <div
      className="break-inside-avoid mb-3 sm:mb-4 rounded-xl overflow-hidden border group relative"
      style={{
        background: "var(--bg-secondary)",
        borderColor: isFailed ? "var(--danger)" : "var(--border)",
      }}
    >
      {isFailed && (
        <button
          onClick={() => onDelete(task.id)}
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/50 text-white/70 hover:bg-red-600 hover:text-white flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10"
          title="删除"
        >
          ✕
        </button>
      )}
      <div
        className="flex flex-col items-center justify-center p-6"
        style={{
          background: "var(--bg-tertiary)",
          minHeight: "12rem",
        }}
      >
        {isProcessing && (
          <>
            <div
              className="w-10 h-10 border-2 rounded-full animate-spin mb-3"
              style={{ borderColor: "var(--border)", borderTopColor: "var(--accent)" }}
            />
            <p className="text-xs text-app-text3 text-center">
              {task.status === "pending" ? "排队中..." : "生成中..."}
            </p>
          </>
        )}
        {isFailed && (
          <>
            <div className="text-2xl mb-2">⚠️</div>
            <p className="text-xs text-center" style={{ color: "var(--danger)" }}>生成失败</p>
            {task.error && (
              <p className="text-xs text-app-text3 mt-1 text-center line-clamp-3 px-2">{task.error}</p>
            )}
          </>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs text-app-text3 line-clamp-2">{task.keywordNames}</p>
      </div>
    </div>
  );
}
