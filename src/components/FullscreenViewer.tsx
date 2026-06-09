"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { ImageRecord } from "@/types";

interface Props {
  records: ImageRecord[];
  activeIndex: number;
  onClose: () => void;
  onDelete?: (id: number) => void;
}

export default function FullscreenViewer({ records, activeIndex, onClose, onDelete }: Props) {
  const [index, setIndex] = useState(activeIndex);
  const [showDetail, setShowDetail] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startPos = useRef({ x: 0, y: 0 });
  const lastPos = useRef({ x: 0, y: 0 });
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const lastDistance = useRef(0);

  const record = records[index];
  if (!record) return null;

  const isVideo = record.type === "video" || /\.(mp4|webm|mov)$/i.test(record.imagePath);
  const src = isVideo ? (record.posterPath || record.imagePath) : record.imagePath;

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, records.length - 1));
    resetZoom();
  }, [records.length]);

  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
    resetZoom();
  }, []);

  function resetZoom() {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }

  const handleDownload = async () => {
    const url = isVideo ? record.imagePath : src;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = url.split("/").pop() || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch {
      // Fallback: open in new tab / trigger system download
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener";
      a.download = url.split("/").pop() || "download";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleCopy = async () => {
    const text = record.prompt || record.keywordNames;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for Android WebView / insecure context
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        alert("复制失败，请长按文本手动复制");
      }
    }
  };

  // Touch handlers for swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      lastDistance.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      return;
    }
    if (e.touches.length === 1 && scale <= 1.01) {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (lastDistance.current) {
        const newScale = Math.min(4, Math.max(0.5, scale * (dist / lastDistance.current)));
        setScale(newScale);
      }
      lastDistance.current = dist;
      return;
    }
    if (e.touches.length === 1 && scale <= 1.01) {
      const dx = e.touches[0].clientX - touchStartX.current;
      const dy = e.touches[0].clientY - touchStartY.current;
      lastPos.current = { x: dx, y: dy };
    }
  };

  const handleTouchEnd = () => {
    if (scale <= 1.01 && Math.abs(lastPos.current.x) > 60) {
      if (lastPos.current.x > 0 && index > 0) goPrev();
      else if (lastPos.current.x < 0 && index < records.length - 1) goNext();
    }
    lastPos.current = { x: 0, y: 0 };
  };

  // Mouse drag for zoomed image
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    startPos.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - startPos.current.x, y: e.clientY - startPos.current.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Double tap / double click to zoom
  const handleDoubleClick = () => {
    if (scale > 1) resetZoom();
    else { setScale(2.5); setPosition({ x: 0, y: 0 }); }
  };

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, goPrev, goNext]);

  const showDetailPanel = () => setShowDetail(true);
  const hideDetailPanel = () => setShowDetail(false);

  return (
    <div className="fixed inset-0 z-50 bg-black" onClick={() => { if (!showDetail) onClose(); }}>
      {/* Image area */}
      <div
        ref={containerRef}
        className="absolute inset-0 flex items-center justify-center"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onClick={(e) => { if (e.target === containerRef.current && !showDetail) onClose(); }}
      >
        {isVideo ? (
          <video src={record.imagePath} controls className="max-w-full max-h-full object-contain" />
        ) : (
          <img
            src={src}
            alt={record.prompt || record.keywordNames}
            className="max-w-full max-h-full object-contain select-none"
            style={{ transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`, transition: isDragging ? "none" : "transform 0.2s", cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default" }}
            draggable={false}
          />
        )}
      </div>

      {/* Top bar */}
      <div className="absolute top-0 inset-x-0 z-10 flex items-center justify-between px-4 py-3">
        <span className="text-white/80 text-sm">{index + 1} / {records.length}</span>
        <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center text-sm">✕</button>
      </div>

      {/* Action bar - bottom */}
      <div className="absolute bottom-0 inset-x-0 z-10 pb-6 px-4" onClick={(e) => e.stopPropagation()}>
        {/* Nav arrows */}
        <div className="flex justify-between items-center mb-4 px-2 pointer-events-none">
          <button
            onClick={goPrev}
            disabled={index === 0}
            className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center pointer-events-auto disabled:opacity-30"
          >
            ‹
          </button>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDetail(!showDetail)}
              className="px-4 py-2 rounded-full bg-white/20 text-white text-sm pointer-events-auto backdrop-blur"
            >
              {showDetail ? "收起" : "详情"}
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2 rounded-full bg-white/20 text-white text-sm pointer-events-auto backdrop-blur"
            >
              下载
            </button>
          </div>
          <button
            onClick={goNext}
            disabled={index === records.length - 1}
            className="w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center pointer-events-auto disabled:opacity-30"
          >
            ›
          </button>
        </div>
      </div>

      {/* Detail panel - slides up from bottom */}
      {showDetail && (
        <div
          className="absolute bottom-0 inset-x-0 z-20 bg-[#1a1a1a] rounded-t-2xl max-h-[55vh] overflow-y-auto animate-slide-up"
          style={{ boxShadow: "0 -4px 24px rgba(0,0,0,0.5)" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-white/30" />
          </div>
          <div className="px-5 pb-6">
            {/* Keywords */}
            {record.keywordNames && (
              <div className="mb-4">
                <p className="text-xs text-white/50 mb-2">关键词</p>
                <div className="flex flex-wrap gap-1.5">
                  {record.keywordNames.split(", ").map((kw) => (
                    <span key={kw} className="px-2.5 py-1 rounded-full text-xs bg-white/10 text-white/80">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Prompt */}
            <div className="mb-4">
              <p className="text-xs text-white/50 mb-2">提示词</p>
              <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap break-all">
                {record.prompt || record.keywordNames}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleCopy}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition"
                style={{ background: copied ? "#22c55e" : "rgba(255,255,255,0.15)", color: "#fff" }}
              >
                {copied ? "已复制" : "复制提示词"}
              </button>
              <button
                onClick={handleDownload}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium transition bg-white/15 text-white"
              >
                {isVideo ? "下载视频" : "下载图片"}
              </button>
              {onDelete && (
                <button
                  onClick={() => { onDelete(record.id); onClose(); }}
                  className="flex-1 py-2.5 rounded-lg text-sm font-medium transition bg-red-500/30 text-red-300"
                >
                  删除
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
