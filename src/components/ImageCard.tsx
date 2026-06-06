"use client";

import { useState } from "react";
import { ImageRecord } from "@/types";
import Lightbox from "./Lightbox";

interface Props {
  record: ImageRecord;
  onDelete: (id: number) => void;
}

function isVideo(path: string) { return /\.(mp4|webm|mov)$/i.test(path); }

export default function ImageCard({ record, onDelete }: Props) {
  const [showLightbox, setShowLightbox] = useState(false);
  const video = isVideo(record.imagePath);

  const handleDownload = async () => {
    try {
      const res = await fetch(record.imagePath);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = record.imagePath.split("/").pop() || (video ? "video.mp4" : "image.png");
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert("下载失败"); }
  };

  return (
    <>
      <div className="break-inside-avoid mb-3 sm:mb-4 overflow-hidden transition group relative">
        {video ? (
          <div className="relative cursor-pointer" onClick={() => setShowLightbox(true)}>
            <video src={record.imagePath} className="w-full h-auto block rounded-lg" muted preload="metadata" />
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
              <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
              </div>
            </div>
          </div>
        ) : (
          <img src={record.imagePath} alt={record.prompt} className="w-full h-auto block rounded-lg cursor-pointer" loading="lazy" onClick={() => setShowLightbox(true)} />
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(record.id); }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white/80 hover:bg-red-600 hover:text-white flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity" title="删除">✕</button>
      </div>

      {showLightbox && (
        <Lightbox src={record.imagePath} alt={record.prompt} keywords={record.keywordNames} onClose={() => setShowLightbox(false)} onDelete={() => onDelete(record.id)} />
      )}
    </>
  );
}
