"use client";

import { useState, useRef } from "react";

interface Props {
  image: string;
  onChange: (base64: string) => void;
}

export default function ImageUploader({ image, onChange }: Props) {
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) { alert("请选择图片文件"); return; }
    const reader = new FileReader();
    reader.onload = () => onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div>
      {image ? (
        <div className="relative inline-block group">
          <img src={image} className="max-h-32 rounded-lg border border-[var(--border)]" alt="参考图" />
          <button
            onClick={() => onChange("")}
            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition ${
            dragging ? "border-[var(--accent)] bg-[var(--accent-light)]" : "border-[var(--border)]"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); }}
          onClick={() => fileRef.current?.click()}
        >
          <p className="text-sm text-[var(--text-muted)]">拖拽图片到此处，或点击上传</p>
          <p className="text-xs text-[var(--text-muted)] mt-1 opacity-60">支持 JPG、PNG、WebP</p>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
    </div>
  );
}
