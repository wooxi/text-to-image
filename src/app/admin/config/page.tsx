"use client";

import { useState, useEffect, useCallback } from "react";

const configSections = [
  {
    title: "LLM",
    desc: "提示词生成 / 润色",
    fields: [
      { key: "llm_endpoint", label: "API 端点", placeholder: "https://api.openai.com/v1" },
      { key: "llm_api_key", label: "API Key", placeholder: "sk-...", type: "password" },
      { key: "llm_model", label: "模型", placeholder: "gpt-4o" },
    ],
  },
  {
    title: "图片生成",
    desc: "gpt-image / Agnes",
    fields: [
      { key: "image_provider", label: "Provider", placeholder: "openai_image" },
      { key: "image_endpoint", label: "API 端点", placeholder: "..." },
      { key: "image_api_key", label: "API Key", placeholder: "sk-...", type: "password" },
      { key: "image_model", label: "模型", placeholder: "gpt-image-1" },
      { key: "image_size", label: "默认尺寸", placeholder: "1024x1024" },
    ],
  },
  {
    title: "视频生成",
    desc: "Agnes Video",
    fields: [
      { key: "video_provider", label: "Provider", placeholder: "agnes_video" },
      { key: "video_endpoint", label: "API 端点", placeholder: "..." },
      { key: "video_api_key", label: "API Key", placeholder: "sk-...", type: "password" },
      { key: "video_model", label: "模型", placeholder: "agnes-video-v2.0" },
    ],
  },
];

const modelTargets: Record<string, "llm" | "image" | "video"> = {
  llm_model: "llm",
  image_model: "image",
  video_model: "video",
};

export default function ConfigPage() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [models, setModels] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const fetchConfig = useCallback(async () => {
    const res = await fetch("/api/config");
    const data = await res.json();
    if (data.success) setValues(data.data);
  }, []);

  const fetchModels = useCallback(async () => {
    const targets = ["llm", "image", "video"];
    const entries = await Promise.all(targets.map(async (target) => {
      try {
        const res = await fetch(`/api/config/models?target=${target}`);
        const data = await res.json();
        return [target, data.success ? data.data : []] as const;
      } catch {
        return [target, []] as const;
      }
    }));
    setModels(Object.fromEntries(entries));
  }, []);

  useEffect(() => { fetchConfig(); fetchModels(); }, [fetchConfig, fetchModels]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      setMessage(data.success ? "保存成功" : data.error || "保存失败");
    } catch {
      setMessage("网络错误");
    } finally {
      setSaving(false);
    }
  };

  const toggleVisible = (key: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleCollapse = (title: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(title) ? next.delete(title) : next.add(title);
      return next;
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-app-text">模型配置</h1>
          <p className="text-xs text-app-text3 mt-0.5">配置 LLM、图片和视频的 API 端点及密钥</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md px-5 py-2 text-xs font-semibold text-white transition-base"
          style={{ background: saving ? "var(--bg-tertiary)" : "var(--accent)" }}
        >
          {saving ? "保存中..." : "保存配置"}
        </button>
      </div>

      {message && (
        <div
          className="mb-4 px-4 py-2 rounded-md text-xs"
          style={{
            background: message === "保存成功" ? "var(--success-bg)" : "var(--danger-bg)",
            color: message === "保存成功" ? "var(--success)" : "var(--danger)",
          }}
        >
          {message}
        </div>
      )}

      <div className="space-y-3">
        {configSections.map((section) => (
          <div key={section.title} className="panel-soft rounded-lg overflow-hidden">
            <button
              onClick={() => toggleCollapse(section.title)}
              className="w-full flex items-center justify-between px-4 py-3 text-left transition-base"
            >
              <div>
                <h3 className="text-sm font-semibold text-app-text">{section.title}</h3>
                <p className="text-[10px] text-app-text3 mt-0.5">{section.desc}</p>
              </div>
              <span className="text-xs text-app-text3 transition-transform" style={{ transform: collapsed.has(section.title) ? "rotate(-90deg)" : "rotate(0)" }}>
                ▼
              </span>
            </button>

            {!collapsed.has(section.title) && (
              <div className="px-4 pb-4 space-y-2.5">
                {section.fields.map((field) => (
                  <div key={field.key}>
                    <label className="block text-[11px] text-app-text3 mb-1">{field.label}</label>
                    {field.type === "password" ? (
                      <div className="flex gap-1.5">
                        <input
                          type={visibleKeys.has(field.key) ? "text" : "password"}
                          value={values[field.key] || ""}
                          onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                          placeholder={field.placeholder}
                          className="flex-1 rounded-md border border-app-border/60 bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-app-text font-mono focus:border-[var(--accent)] focus:outline-none"
                        />
                        <button
                          onClick={() => toggleVisible(field.key)}
                          className="rounded-md border border-app-border/60 px-2 py-2 text-[10px] text-app-text3 transition-base hover:text-app-text2"
                        >
                          {visibleKeys.has(field.key) ? "隐藏" : "显示"}
                        </button>
                      </div>
                    ) : modelTargets[field.key] && models[modelTargets[field.key]]?.length > 0 ? (
                      <select
                        value={values[field.key] || ""}
                        onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                        className="w-full rounded-md border border-app-border/60 bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-app-text focus:border-[var(--accent)] focus:outline-none"
                      >
                        <option value="">选择模型...</option>
                        {models[modelTargets[field.key]].map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={values[field.key] || ""}
                        onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                        placeholder={field.placeholder}
                        className="w-full rounded-md border border-app-border/60 bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-app-text focus:border-[var(--accent)] focus:outline-none"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
