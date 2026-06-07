"use client";

import { useEffect, useMemo, useState } from "react";
import { KeywordGroup } from "@/types";

interface Props {
  groups: KeywordGroup[];
  selected: string[];
  onToggle: (keyword: string) => void;
  onClear?: () => void;
}

export default function KeywordSelector({ groups, selected, onToggle, onClear }: Props) {
  const [query, setQuery] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    if (!normalizedQuery) return;
    setExpandedGroups((prev) => {
      const next = { ...prev };
      for (const group of groups) next[group.slug] = true;
      return next;
    });
  }, [groups, normalizedQuery]);

  const filteredGroups = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        keywords: group.keywords.filter((kw) => {
          if (showSelectedOnly && !selected.includes(kw.name)) return false;
          return !normalizedQuery || kw.name.toLowerCase().includes(normalizedQuery);
        }),
      }))
      .filter((group) => group.keywords.length > 0 || !normalizedQuery);
  }, [groups, normalizedQuery, selected, showSelectedOnly]);

  const toggleGroup = (slug: string) => {
    setExpandedGroups((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索关键词，例如 逆光、85mm、电影感"
            className="w-full rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text placeholder:text-app-text3 focus:outline-none focus:border-app-border-hover"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-app-text3">
          <span>{groups.length} 个分类</span>
          <span className="h-3 w-px bg-app-border" />
          <span>{selected.length} 个已选</span>
          <button
            type="button"
            onClick={() => setShowSelectedOnly((prev) => !prev)}
            className="rounded-md border border-app-border bg-app-bg px-2.5 py-1 text-xs text-app-text2 transition hover:text-app-text"
          >
            {showSelectedOnly ? "查看全部" : "仅看已选"}
          </button>
          {selected.length > 0 && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-md border border-app-border bg-app-bg px-2.5 py-1 text-xs text-app-text2 transition hover:text-app-text"
            >
              清空
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
        {filteredGroups.map((group) => {
          const selectedCount = group.keywords.filter((kw) => selected.includes(kw.name)).length;
          const expanded = normalizedQuery ? true : (expandedGroups[group.slug] ?? selectedCount > 0);
          const visibleKeywords = expanded ? group.keywords : group.keywords.slice(0, 8);
          const hiddenCount = Math.max(group.keywords.length - visibleKeywords.length, 0);

          return (
            <section key={group.id} className="rounded-xl border border-app-border bg-app-bg p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-app-text">{group.name}</h3>
                  {group.description && <p className="mt-1 text-xs leading-5 text-app-text3">{group.description}</p>}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <span className="rounded-md bg-app-bg2 px-2 py-1 text-[11px] text-app-text3">{selectedCount}/{group.keywords.length}</span>
                  {group.keywords.length > 8 && !normalizedQuery && (
                    <button
                      type="button"
                      onClick={() => toggleGroup(group.slug)}
                      className="text-[11px] text-app-text3 transition hover:text-app-text"
                    >
                      {expanded ? "收起" : `展开 ${hiddenCount} 个`}
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
              {visibleKeywords.map((kw) => {
                const active = selected.includes(kw.name);
                return (
                  <button
                    key={kw.id}
                    type="button"
                    onClick={() => onToggle(kw.name)}
                    className="rounded-full border px-3 py-2 text-sm transition-all"
                    style={{
                      background: active ? "var(--accent-light)" : "var(--bg-secondary)",
                      borderColor: active ? "var(--accent)" : "var(--border)",
                      color: active ? "var(--accent)" : "var(--text-secondary)",
                      boxShadow: active ? "0 0 0 1px var(--accent) inset" : "none",
                    }}
                  >
                    {kw.name}
                  </button>
                );
              })}
              </div>

              {!expanded && hiddenCount > 0 && (
                <p className="mt-3 text-[11px] text-app-text3">还有 {hiddenCount} 个词已收起，展开后可继续选择。</p>
              )}
            </section>
          );
        })}
      </div>

      {filteredGroups.length === 0 && (
        <div className="rounded-xl border border-dashed border-app-border bg-app-bg px-4 py-8 text-center text-sm text-app-text3">
          没有匹配到关键词，换个词试试。
        </div>
      )}
    </div>
  );
}
