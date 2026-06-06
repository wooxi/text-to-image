"use client";

import { useState } from "react";

interface Props {
  src: string;
  alt: string;
  keywords: string;
  onClose: () => void;
  onDelete?: () => void;
}

export default function Lightbox({ src, alt, keywords, onClose, onDelete }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(alt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = alt;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = src.split("/").pop() || "image.png";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("下载失败");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex flex-col md:flex-row gap-0 max-w-[95vw] max-h-[95vh] bg-[var(--bg-secondary)] rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 flex items-center justify-center bg-black/30 md:max-w-[60vw] max-h-[50vh] md:max-h-[90vh]">
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-[50vh] md:max-h-[90vh] object-contain"
          />
        </div>

        <div className="flex flex-col p-5 md:w-80 lg:w-96 overflow-auto max-h-[45vh] md:max-h-[90vh]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-[var(--text-primary)]">图片详情</h3>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full border border-[var(--border)] text-[var(--text-secondary)] flex items-center justify-center text-sm hover:bg-[var(--bg-tertiary)] transition flex-shrink-0"
            >
              ✕
            </button>
          </div>

          {keywords && (
            <div className="mb-3">
              <p className="text-xs text-[var(--text-muted)] mb-1">关键词</p>
              <div className="flex flex-wrap gap-1">
                {keywords.split(", ").map((kw) => (
                  <span
                    key={kw}
                    className="px-2 py-0.5 rounded text-xs"
                    style={{ background: "var(--accent-light)", color: "var(--accent)" }}
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1">
            <p className="text-xs text-[var(--text-muted)] mb-1">提示词</p>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed whitespace-pre-wrap break-all">
              {alt}
            </p>
          </div>

          <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--border)]">
            <button
              onClick={handleCopy}
              className="flex-1 py-2 text-xs rounded-lg transition text-white"
              style={{ background: copied ? "var(--success)" : "var(--accent)" }}
            >
              {copied ? "已复制" : "复制提示词"}
            </button>
            <button
              onClick={handleDownload}
              className="flex-1 py-2 text-xs rounded-lg transition"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-primary)" }}
            >
              下载图片
            </button>
            {onDelete && (
              <button
                onClick={() => { onDelete(); onClose(); }}
                className="flex-1 py-2 text-xs rounded-lg transition"
                style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
              >
                删除
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
