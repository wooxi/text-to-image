"use client";

import { useState } from "react";
import { ImageRecord } from "@/types";
import Lightbox from "./Lightbox";

interface Props {
  record: ImageRecord;
  onDelete: (id: number) => void;
}

export default function ImageCard({ record, onDelete }: Props) {
  const [showLightbox, setShowLightbox] = useState(false);

  return (
    <>
      <div className="break-inside-avoid mb-3 sm:mb-4 overflow-hidden transition group relative">
        <img
          src={record.imagePath}
          alt={record.prompt}
          className="w-full h-auto block rounded-lg cursor-pointer"
          loading="lazy"
          onClick={() => setShowLightbox(true)}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(record.id);
          }}
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white/80 hover:bg-red-600 hover:text-white flex items-center justify-center text-sm opacity-0 group-hover:opacity-100 transition-opacity"
          title="删除"
        >
          ✕
        </button>
      </div>

      {showLightbox && (
        <Lightbox
          src={record.imagePath}
          alt={record.prompt}
          keywords={record.keywordNames}
          onClose={() => setShowLightbox(false)}
          onDelete={() => onDelete(record.id)}
        />
      )}
    </>
  );
}
