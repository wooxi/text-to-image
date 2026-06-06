"use client";

import { useState, useEffect, useCallback } from "react";
import { KeywordGroup } from "@/types";

export default function KeywordsPage() {
  const [groups, setGroups] = useState<KeywordGroup[]>([]);
  const [editing, setEditing] = useState<KeywordGroup | null>(null);
  const [creating, setCreating] = useState(false);

  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formKeywords, setFormKeywords] = useState("");

  const fetchGroups = useCallback(async () => {
    const res = await fetch("/api/keywords");
    const data = await res.json();
    if (data.success) setGroups(data.data);
  }, []);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setFormName("");
    setFormSlug("");
    setFormKeywords("");
  };

  const openEdit = (group: KeywordGroup) => {
    setCreating(false);
    setEditing(group);
    setFormName(group.name);
    setFormSlug(group.slug);
    setFormKeywords(group.keywords.map((k) => k.name).join("\n"));
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
  };

  const handleSave = async () => {
    const kwList = formKeywords.split("\n").filter((k) => k.trim());
    if (!formName || (!creating && !editing)) return;

    const url = "/api/keywords";
    let method = "POST";
    let body: Record<string, unknown> = { name: formName, slug: formSlug, keywords: kwList };

    if (editing) {
      method = "PUT";
      body = { id: editing.id, name: formName, keywords: kwList };
    }

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) {
      fetchGroups();
      closeForm();
    } else {
      alert(data.error || "保存失败");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除这个词组吗？其下的关键词也会被删除。")) return;
    const res = await fetch(`/api/keywords?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      fetchGroups();
    } else {
      alert(data.error || "删除失败");
    }
  };

  const inputClass = "w-full px-3 py-2 bg-app-bg border border-app-border rounded-lg text-app-text text-sm focus:outline-none";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-app-text">关键词管理</h1>
        <button
          onClick={openCreate}
          className="px-4 py-2 text-white text-sm rounded-lg transition"
          style={{ background: "var(--accent)" }}
        >
          新建词组
        </button>
      </div>

      {(creating || editing) && (
        <div className="bg-app-bg2 border border-app-border rounded-xl p-4 mb-6 space-y-3">
          <h3 className="text-app-text font-medium">{creating ? "新建词组" : "编辑词组"}</h3>
          <div>
            <label className="block text-xs text-app-text3 mb-1">词组名称</label>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className={inputClass}
              placeholder="如：场景"
            />
          </div>
          {creating && (
            <div>
              <label className="block text-xs text-app-text3 mb-1">标识符 (英文)</label>
              <input
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                className={inputClass}
                placeholder="如：scene"
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-app-text3 mb-1">关键词 (每行一个)</label>
            <textarea
              value={formKeywords}
              onChange={(e) => setFormKeywords(e.target.value)}
              rows={6}
              className={`${inputClass} resize-none`}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-white text-sm rounded-lg transition"
              style={{ background: "var(--accent)" }}
            >
              保存
            </button>
            <button
              onClick={closeForm}
              className="px-4 py-1.5 text-sm rounded-lg transition"
              style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.id} className="bg-app-bg2 border border-app-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-app-text font-medium">{group.name}</h3>
                <p className="text-xs text-app-text3">{group.slug}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(group)}
                  className="px-3 py-1 text-xs rounded transition"
                  style={{ background: "var(--bg-tertiary)", color: "var(--text-secondary)" }}
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(group.id)}
                  className="px-3 py-1 text-xs rounded transition"
                  style={{ background: "var(--danger-bg)", color: "var(--danger)" }}
                >
                  删除
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {group.keywords.map((kw) => (
                <span
                  key={kw.id}
                  className="px-2 py-0.5 rounded bg-app-bg text-app-text2 text-xs"
                >
                  {kw.name}
                </span>
              ))}
            </div>
          </div>
        ))}

        {groups.length === 0 && (
          <p className="text-app-text3 text-center py-10">暂无关键词组，点击"新建词组"开始创建。</p>
        )}
      </div>
    </div>
  );
}
