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
}

export default function TaskCard({ task }: Props) {
  const isFailed = task.status === "failed";
  const isProcessing = task.status === "pending" || task.status === "processing";

  return (
    <div
      className="break-inside-avoid mb-3 sm:mb-4 rounded-xl overflow-hidden border"
      style={{
        background: "var(--bg-secondary)",
        borderColor: isFailed ? "var(--danger)" : "var(--border)",
      }}
    >
      <div
        className="flex flex-col items-center justify-center p-6 aspect-[3/4]"
        style={{ background: "var(--bg-tertiary)" }}
      >
        {isProcessing && (
          <>
            <div
              className="w-10 h-10 border-2 rounded-full animate-spin mb-3"
              style={{
                borderColor: "var(--border)",
                borderTopColor: "var(--accent)",
              }}
            />
            <p className="text-xs text-app-text3 text-center">
              {task.status === "pending" ? "排队中..." : "生成中..."}
            </p>
          </>
        )}
        {isFailed && (
          <>
            <div className="text-2xl mb-2">⚠️</div>
            <p className="text-xs text-center" style={{ color: "var(--danger)" }}>
              生成失败
            </p>
            {task.error && (
              <p className="text-xs text-app-text3 mt-1 text-center line-clamp-3 px-2">
                {task.error}
              </p>
            )}
          </>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs text-app-text3 line-clamp-2">
          {task.keywordNames}
        </p>
      </div>
    </div>
  );
}
