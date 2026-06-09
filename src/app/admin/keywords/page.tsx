"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { KeywordGroup } from "@/types";

function slugFromName(name: string): string {
  return name
    .replace(/[\s/]+/g, "-")
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff\-]/g, "")
    .toLowerCase()
    .slice(0, 40)
    || `group-${Date.now().toString(36)}`;
}

export default function KeywordsPage() {
  const [groups, setGroups] = useState<KeywordGroup[]>([]);
  const [editingName, setEditingName] = useState<number | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [addingKeyword, setAddingKeyword] = useState<number | null>(null);
  const [addKwValue, setAddKwValue] = useState("");
  const [newKwValue, setNewKwValue] = useState("");
  const [dragOverGroup, setDragOverGroup] = useState<number | null>(null);
  const dragKw = useRef<{ groupId: number; kwId: number; name: string } | null>(null);

  const fetchGroups = useCallback(async () => {
    const res = await fetch("/api/keywords");
    const data = await res.json();
    if (data.success) setGroups(data.data);
  }, []);

  useEffect(() => { fetchGroups(); }, [fetchGroups]);

  const inputClass = "w-full rounded-md border border-app-border/60 bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-app-text placeholder:text-app-text3 focus:outline-none focus:border-[var(--accent)]";

  // ── Group CRUD ──

  const handleCreateGroup = async () => {
    const name = newName.trim();
    if (!name) return;
    const slug = newSlug.trim() || slugFromName(name);
    const res = await fetch("/api/keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, keywords: [] }),
    });
    if ((await res.json()).success) {
      setNewName("");
      setNewSlug("");
      fetchGroups();
    }
  };

  const handleDeleteGroup = async (id: number) => {
    if (!confirm("确定删除这个词组吗？")) return;
    await fetch(`/api/keywords?id=${id}`, { method: "DELETE" });
    fetchGroups();
  };

  const startRename = (group: KeywordGroup) => {
    setEditingName(group.id);
    setEditNameValue(group.name);
  };

  const saveRename = async (id: number) => {
    const name = editNameValue.trim();
    if (!name) return;
    const group = groups.find((g) => g.id === id);
    if (!group || name === group.name) { setEditingName(null); return; }
    const kwList = group.keywords.map((k) => k.name);
    await fetch("/api/keywords", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name, keywords: kwList }),
    });
    setEditingName(null);
    fetchGroups();
  };

  // ── Keyword add / remove ──

  const addKeyword = async (groupId: number, kw: string) => {
    const name = kw.trim();
    if (!name) return;
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const existing = group.keywords.map((k) => k.name);
    if (existing.includes(name)) { setAddKwValue(""); return; }
    await fetch("/api/keywords", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: groupId, name: group.name, keywords: [...existing, name] }),
    });
    setAddKwValue("");
    fetchGroups();
  };

  const removeKeyword = async (groupId: number, kwName: string) => {
    const group = groups.find((g) => g.id === groupId);
    if (!group) return;
    const keywords = group.keywords.filter((k) => k.name !== kwName).map((k) => k.name);
    await fetch("/api/keywords", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: groupId, name: group.name, keywords }),
    });
    fetchGroups();
  };

  // ── Drag-and-drop reorder ──

  const handleDragStart = (groupId: number, kwId: number, name: string) => {
    dragKw.current = { groupId, kwId, name };
  };

  const handleDragOver = (e: React.DragEvent, groupId: number) => {
    e.preventDefault();
    if (dragKw.current && dragKw.current.groupId === groupId) {
      setDragOverGroup(groupId);
    }
  };

  const handleDrop = async (groupId: number, targetKwName: string) => {
    setDragOverGroup(null);
    const d = dragKw.current;
    if (!d || d.groupId !== groupId || d.name === targetKwName) return;

    const group = groups.find((g) => g.id === groupId);
    if (!group) return;

    const keywords = group.keywords.map((k) => k.name);
    const srcIdx = keywords.indexOf(d.name);
    const tgtIdx = keywords.indexOf(targetKwName);
    if (srcIdx === -1 || tgtIdx === -1) return;

    const reordered = [...keywords];
    reordered.splice(srcIdx, 1);
    reordered.splice(tgtIdx, 0, d.name);

    await fetch("/api/keywords", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: groupId, name: group.name, keywords: reordered }),
    });
    dragKw.current = null;
    fetchGroups();
  };

  const handleDragEnd = () => {
    setDragOverGroup(null);
    dragKw.current = null;
  };

  // ── Inline keyword adder ──

  const handleAddKeyDown = (e: React.KeyboardEvent, groupId: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addKeyword(groupId, addKwValue);
    }
    if (e.key === "Escape") {
      setAddingKeyword(null);
      setAddKwValue("");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-app-text">关键词管理</h1>
          <p className="mt-0.5 text-xs text-app-text3">编辑各组关键词，拖拽排列顺序。修改后自动生效到前台。</p>
        </div>
      </div>

      {/* New group card */}
      <div className="panel-soft rounded-lg border border-dashed border-app-border/60 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-app-text">新建词组</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[120px]">
            <label className="block text-[11px] text-app-text3 mb-1">名称</label>
            <input
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
                if (!newSlug || newSlug === slugFromName(newName)) {
                  setNewSlug(slugFromName(e.target.value));
                }
              }}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateGroup(); }}
              className={inputClass}
              placeholder="如：特殊场景"
            />
          </div>
          <div className="w-40">
            <label className="block text-[11px] text-app-text3 mb-1">
              标识 <span className="text-app-text3/50">(自动生成)</span>
            </label>
            <input
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              className={`${inputClass} text-xs font-mono`}
              placeholder="auto"
            />
          </div>
          <button
            onClick={handleCreateGroup}
            disabled={!newName.trim()}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-white transition-base hover:bg-[var(--accent-hover)] disabled:opacity-30"
          >
            创建
          </button>
        </div>
      </div>

      {/* Group cards */}
      <div className="space-y-3">
        {groups.map((group) => (
          <div
            key={group.id}
            className="panel-soft rounded-lg p-4 space-y-3"
            onDragOver={(e) => handleDragOver(e, group.id)}
            onDragLeave={() => setDragOverGroup(null)}
            style={{
              outline: dragOverGroup === group.id ? "1px dashed var(--accent)" : "none",
              outlineOffset: "-2px",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-baseline gap-3 min-w-0 flex-1">
                {editingName === group.id ? (
                  <input
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename(group.id);
                      if (e.key === "Escape") setEditingName(null);
                    }}
                    onBlur={() => saveRename(group.id)}
                    className="text-lg font-semibold bg-transparent border-b border-[var(--accent)] text-app-text outline-none px-0 py-0 min-w-0 flex-1"
                    autoFocus
                  />
                ) : (
                  <h2
                    className="text-lg font-semibold text-app-text cursor-pointer hover:text-[var(--accent)] transition-base truncate"
                    onClick={() => startRename(group)}
                    title="双击改名"
                  >
                    {group.name}
                  </h2>
                )}
                <span className="text-[10px] font-mono text-app-text3 shrink-0">{group.slug}</span>
                <span className="text-[11px] text-app-text3 tabular-nums">{group.keywords.length} 词</span>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => startRename(group)}
                  className="rounded-md border border-app-border/60 px-2.5 py-1.5 text-[11px] text-app-text3 transition-base hover:border-[var(--border-hover)] hover:text-app-text2"
                >
                  改名
                </button>
                <button
                  onClick={() => handleDeleteGroup(group.id)}
                  className="rounded-md border border-[var(--danger)]/30 px-2.5 py-1.5 text-[11px] text-[var(--danger)] transition-base hover:bg-[var(--danger-bg)]"
                >
                  删除
                </button>
              </div>
            </div>

            {/* Keywords chips — draggable */}
            <div className="flex flex-wrap gap-2 items-center">
              {group.keywords.map((kw) => (
                <div
                  key={kw.id}
                  draggable
                  onDragStart={() => handleDragStart(group.id, kw.id, kw.name)}
                  onDragEnd={handleDragEnd}
                  onDrop={(e) => { e.preventDefault(); handleDrop(group.id, kw.name); }}
                  onDragOver={(e) => e.preventDefault()}
                  className="group flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm font-medium cursor-grab active:cursor-grabbing transition-base hover:border-[var(--accent)]"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    borderColor: "var(--border)",
                    color: "var(--text-secondary)",
                  }}
                >
                  <span className="text-[10px] text-app-text3/40 mr-0.5 select-none">⠿</span>
                  <span>{kw.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeKeyword(group.id, kw.name); }}
                    className="ml-1 text-app-text3/40 hover:text-[var(--danger)] transition-base text-xs leading-none -mr-0.5"
                    title="删除"
                  >
                    ×
                  </button>
                </div>
              ))}

              {/* Inline add input */}
              {addingKeyword === group.id ? (
                <input
                  value={addKwValue}
                  onChange={(e) => setAddKwValue(e.target.value)}
                  onKeyDown={(e) => handleAddKeyDown(e, group.id)}
                  onBlur={() => { if (!addKwValue) setAddingKeyword(null); }}
                  className="rounded-md border border-dashed border-[var(--accent)] bg-transparent px-3 py-1.5 text-sm text-app-text placeholder:text-app-text3/50 outline-none w-28"
                  placeholder="新词"
                  autoFocus
                />
              ) : (
                <button
                  onClick={() => { setAddingKeyword(group.id); setAddKwValue(""); }}
                  className="rounded-md border border-dashed border-app-border/60 px-3 py-1.5 text-sm text-app-text3/50 transition-base hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  + 添加
                </button>
              )}
            </div>
          </div>
        ))}

        {groups.length === 0 && (
          <div className="rounded-lg border border-dashed border-app-border/40 py-16 text-center">
            <p className="text-sm text-app-text3">暂无关键词组</p>
            <p className="mt-1 text-xs text-app-text3/60">在上方填入名称后点击创建</p>
          </div>
        )}

        {/* Drag hint */}
        {groups.length > 0 && (
          <p className="text-center text-[10px] text-app-text3/50">
            拖拽 ⠿ 图标可调整关键词在各组内的排列顺序
          </p>
        )}
      </div>
    </div>
  );
}
