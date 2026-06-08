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

    return (
      <div key={facet.slug} className="space-y-1">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-baseline gap-1.5 min-w-0">
            <span className="text-[11px] font-medium text-app-text2 truncate">{facet.name}</span>
            <span className="text-[9px] text-app-text3 shrink-0">
              {facet.selectionMode === "single" ? "单选" : `≤${facet.maxSelect || facet.keywords.length}`}
            </span>
          </div>
          <span className="text-[9px] tabular-nums text-app-text3 shrink-0">
            {selectedCount}/{facet.selectionMode === "single" ? 1 : (facet.maxSelect || facet.keywords.length)}
          </span>
        </div>

        <div className="flex flex-wrap gap-1">
          {facet.keywords.map((kw) => {
            const active = selected.includes(kw.name);
            return (
              <button
                key={kw.id}
                type="button"
                onClick={() => onToggle(kw.name)}
                className="rounded-sm border px-1.5 py-0.5 text-[11px] font-medium transition-base"
                style={{
                  background: active ? "var(--accent-light)" : "var(--bg-tertiary)",
                  borderColor: active ? "var(--accent)" : "transparent",
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
    <div className="space-y-2">
      {/* Search bar — compact */}
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索关键词..."
          className="flex-1 min-w-[140px] rounded-md border border-app-border/60 bg-[var(--bg-tertiary)] px-2.5 py-1.5 text-xs text-app-text placeholder:text-app-text3 focus:border-[var(--border-hover)] focus:outline-none"
        />
        <span className="text-[10px] text-app-text3 tabular-nums">{groups.length}组</span>
        <span className="text-[10px] text-app-text3 tabular-nums">{selected.length}已选</span>
        <button
          type="button"
          onClick={() => setShowSelectedOnly((prev) => !prev)}
          className="rounded-sm border border-app-border/60 px-2 py-1 text-[10px] text-app-text3 transition-base hover:border-[var(--border-hover)] hover:text-app-text2"
        >
          {showSelectedOnly ? "全部" : "已选"}
        </button>
        {selected.length > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="rounded-sm border border-app-border/60 px-2 py-1 text-[10px] text-app-text3 transition-base hover:border-[var(--danger)] hover:text-[var(--danger)]"
          >
            清空
          </button>
        )}
      </div>

      {/* Non-parameter groups — 2-column grid */}
      {nonParameterGroups.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {nonParameterGroups.map((group) => {
            const groupSelected = (group.facets || []).reduce((sum, facet) => sum + facetSelectedCount(facet, selected), 0);

            return (
              <div key={group.id} className="panel-soft rounded-md p-2.5 space-y-2">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <h3 className="text-xs font-semibold text-app-text truncate">{group.name}</h3>
                    {group.description && (
                      <span className="text-[9px] text-app-text3 truncate hidden sm:inline">{group.description}</span>
                    )}
                  </div>
                  <span className="text-[9px] tabular-nums text-app-text3 shrink-0">{groupSelected}选</span>
                </div>
                <div className="space-y-2">
                  {(group.facets || []).map(renderFacet)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Parameter groups (output) — compact accordion-like card */}
      {parameterGroups.length > 0 && (
        <div className="panel-soft rounded-md p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-baseline gap-1.5">
              <h3 className="text-xs font-semibold text-app-text2">输出参数</h3>
              <span className="text-[9px] text-app-text3">不参与语义描述</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {parameterGroups.flatMap((group) => group.facets || []).map(renderFacet)}
          </div>
        </div>
      )}

      {filteredGroups.length === 0 && (
        <div className="rounded-md border border-dashed border-app-border/40 px-4 py-8 text-center text-xs text-app-text3">
          {groups.length === 0 ? "正在加载关键词..." : "没有匹配到关键词，换个词试试。"}
        </div>
      )}
    </div>
  );
}
