"use client";

import { useState, useEffect, useCallback } from "react";

const configFields = [
  { key: "llm_endpoint", label: "LLM API 端点", placeholder: "https://api.openai.com/v1" },
  { key: "llm_api_key", label: "LLM API Key", placeholder: "sk-...", type: "password" },
  { key: "llm_model", label: "LLM 模型名称", placeholder: "gpt-4o" },
  { key: "image_endpoint", label: "生图 API 端点", placeholder: "https://apihub.agnes-ai.com/v1" },
  { key: "image_api_key", label: "生图 API Key", placeholder: "sk-...", type: "password" },
  { key: "image_model", label: "生图模型名称", placeholder: "agnes-image-2.1-flash" },
  { key: "image_size", label: "默认图片尺寸", placeholder: "1024x1024" },
  { key: "video_endpoint", label: "视频 API 端点", placeholder: "https://apihub.agnes-ai.com" },
  { key: "video_api_key", label: "视频 API Key", placeholder: "sk-...", type: "password" },
  { key: "video_model", label: "视频模型名称", placeholder: "agnes-video-v2.0" },
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

  useEffect(() => {
    fetchConfig();
    fetchModels();
  }, [fetchConfig, fetchModels]);

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
      if (data.success) {
        setMessage("保存成功");
      } else {
        setMessage(data.error || "保存失败");
      }
    } catch {
      setMessage("网络错误");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-app-text">模型配置</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-white text-sm rounded-lg transition"
          style={{
            background: saving ? "var(--bg-tertiary)" : "var(--accent)",
            color: saving ? "var(--text-muted)" : "#fff",
          }}
        >
          {saving ? "保存中..." : "保存配置"}
        </button>
      </div>

      {message && (
        <div
          className="mb-4 px-4 py-2 rounded-lg text-sm"
          style={{
            background: message === "保存成功" ? "var(--success-bg)" : "var(--danger-bg)",
            color: message === "保存成功" ? "var(--success)" : "var(--danger)",
          }}
        >
          {message}
        </div>
      )}

      <div className="space-y-4">
        {configFields.map((field) => (
          <div key={field.key} className="bg-app-bg2 border border-app-border rounded-xl p-4">
            <label className="block text-sm text-app-text mb-2">{field.label}</label>
            {modelTargets[field.key] && models[modelTargets[field.key]]?.length > 0 ? (
              <select
                value={values[field.key] || ""}
                onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg text-app-text text-sm focus:outline-none"
              >
                <option value="">请选择模型</option>
                {models[modelTargets[field.key]].map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.type || "text"}
                value={values[field.key] || ""}
                onChange={(e) => setValues({ ...values, [field.key]: e.target.value })}
                placeholder={field.placeholder}
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg text-app-text text-sm focus:outline-none"
              />
            )}
            <p className="text-xs text-app-text3 mt-1">Key: {field.key}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
