"use client";

import { useMemo, useState } from "react";
import { Keyword, KeywordFacet, KeywordGroup } from "@/types";

interface Props {
  groups: KeywordGroup[];
  selected: string[];
  onToggle: (keyword: string) => void;
  onClear?: () => void;
}

function facetSelectedCount(facet: KeywordFacet, selected: string[]) {
  return facet.keywords.filter((kw) => selected.includes(kw.name)).length;
}

function keywordMatchesQuery(keyword: Keyword, normalizedQuery: string) {
  return !normalizedQuery || keyword.name.toLowerCase().includes(normalizedQuery);
}

export default function KeywordSelector({ groups, selected, onToggle, onClear }: Props) {
  const [query, setQuery] = useState("");
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        facets: (group.facets || []).map((facet) => ({
          ...facet,
          keywords: facet.keywords.filter((kw) => {
            if (showSelectedOnly && !selected.includes(kw.name)) return false;
            return keywordMatchesQuery(kw, normalizedQuery);
          }),
        })).filter((facet) => facet.keywords.length > 0 || (!normalizedQuery && !showSelectedOnly)),
        keywords: group.keywords.filter((kw) => {
          if (showSelectedOnly && !selected.includes(kw.name)) return false;
          return keywordMatchesQuery(kw, normalizedQuery);
        }),
      }))
      .filter((group) => (group.facets && group.facets.length > 0) || group.keywords.length > 0 || (!normalizedQuery && !showSelectedOnly));
  }, [groups, normalizedQuery, selected, showSelectedOnly]);

  const nonParameterGroups = filteredGroups.filter((group) => !group.parameterGroup);
  const parameterGroups = filteredGroups.filter((group) => group.parameterGroup);

  const renderFacet = (facet: KeywordFacet) => {
    const selectedCount = facetSelectedCount(facet, selected);
    const max = facet.selectionMode === "single" ? 1 : (facet.maxSelect || facet.keywords.length);

    return (
      <div key={facet.slug} className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-sm font-medium text-app-text2 truncate">{facet.name}</span>
            <span className="text-[11px] text-app-text3 shrink-0">
              {facet.selectionMode === "single" ? "单选" : `最多 ${max} 项`}
            </span>
          </div>
          <span className="text-[11px] tabular-nums text-app-text3 shrink-0">
            {selectedCount}/{max}
          </span>
        </div>

        <div className="flex flex-wrap gap-2.5 max-h-[200px] overflow-y-auto scrollbar-thin pr-1">
          {facet.keywords.map((kw) => {
            const active = selected.includes(kw.name);
            return (
              <button
                key={kw.id}
                type="button"
                onClick={() => onToggle(kw.name)}
                className="rounded-md border px-3 py-1.5 text-sm font-medium transition-base"
                style={{
                  background: active
                    ? "var(--accent-light)"
                    : "rgba(255,255,255,0.03)",
                  borderColor: active ? "var(--accent)" : "var(--border)",
                  color: active ? "var(--accent)" : "var(--text-secondary)",
                }}
              >
                {kw.name}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Search bar */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索关键词..."
          className="flex-1 min-w-[160px] rounded-md border border-app-border/60 bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-app-text placeholder:text-app-text3 focus:border-[var(--border-hover)] focus:outline-none"
        />
        <span className="text-[11px] text-app-text3 tabular-nums">{groups.length} 组</span>
        <span className="text-[11px] text-app-text3 tabular-nums">{selected.length} 已选</span>
        <button
          type="button"
          onClick={() => setShowSelectedOnly((prev) => !prev)}
          className="rounded-md border border-app-border/60 px-3 py-1.5 text-xs text-app-text3 transition-base hover:border-[var(--border-hover)] hover:text-app-text2"
        >
          {showSelectedOnly ? "全部" : "仅看已选"}
        </button>
        {selected.length > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md border border-app-border/60 px-3 py-1.5 text-xs text-app-text3 transition-base hover:border-[var(--danger)] hover:text-[var(--danger)]"
          >
            清空
          </button>
        )}
      </div>

      {/* Non-parameter groups — 2-column grid with breathing room */}
      {nonParameterGroups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {nonParameterGroups.map((group) => {
            const groupSelected = (group.facets || []).reduce((sum, facet) => sum + facetSelectedCount(facet, selected), 0);

            return (
              <div key={group.id} className="panel-soft rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <h3 className="text-base font-semibold text-app-text truncate">{group.name}</h3>
                    {group.description && (
                      <span className="text-[11px] text-app-text3 truncate hidden sm:inline">{group.description}</span>
                    )}
                  </div>
                  <span className="text-xs tabular-nums text-app-text3 shrink-0">{groupSelected} 选</span>
                </div>
                <div className="space-y-4">
                  {(group.facets || []).map(renderFacet)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Parameter groups (output) */}
      {parameterGroups.length > 0 && (
        <div className="panel-soft rounded-lg p-5 space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-app-text2">输出参数</h3>
            <span className="text-[11px] text-app-text3">比例与清晰度，不参与语义推理</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {parameterGroups.flatMap((group) => group.facets || []).map(renderFacet)}
          </div>
        </div>
      )}

      {filteredGroups.length === 0 && (
        <div className="rounded-lg border border-dashed border-app-border/40 px-6 py-12 text-center text-sm text-app-text3">
          {groups.length === 0 ? "正在加载关键词..." : "没有匹配到关键词，换个词试试。"}
        </div>
      )}
    </div>
  );
}
