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
      <section key={facet.slug} className="rounded-xl border border-app-border bg-app-bg p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-app-text">{facet.name}</h4>
              <span className="rounded-md bg-app-bg2 px-2 py-0.5 text-[11px] text-app-text3">
                {facet.selectionMode === "single" ? "单选" : `最多 ${facet.maxSelect || facet.keywords.length} 个`}
              </span>
            </div>
            {facet.description && <p className="mt-1 text-xs leading-5 text-app-text3">{facet.description}</p>}
          </div>
          <span className="text-[11px] text-app-text3">{selectedCount}/{facet.selectionMode === "single" ? 1 : (facet.maxSelect || facet.keywords.length)}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {facet.keywords.map((kw) => {
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
      </section>
    );
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

      {nonParameterGroups.map((group) => {
        const groupSelected = (group.facets || []).reduce((sum, facet) => sum + facetSelectedCount(facet, selected), 0);

        return (
          <section key={group.id} className="border-b border-app-border pb-6 last:border-b-0 last:pb-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-app-text">{group.name}</h3>
                {group.description && <p className="mt-1 text-xs leading-5 text-app-text3">{group.description}</p>}
              </div>
              <span className="rounded-md bg-app-bg2 px-2 py-0.5 text-[11px] text-app-text3">{groupSelected} 已选</span>
            </div>
            <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
              {(group.facets || []).map(renderFacet)}
            </div>
          </section>
        );
      })}

      {parameterGroups.length > 0 && (
        <section className="rounded-xl border border-app-border bg-app-bg2 p-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-app-text">输出参数</h3>
            <p className="mt-1 text-xs leading-5 text-app-text3">这些参数影响比例和清晰度，不参与画面语义描述。</p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {parameterGroups.flatMap((group) => group.facets || []).map(renderFacet)}
          </div>
        </section>
      )}

      {filteredGroups.length === 0 && (
        <div className="rounded-xl border border-dashed border-app-border bg-app-bg px-4 py-8 text-center text-sm text-app-text3">
          没有匹配到关键词，换个词试试。
        </div>
      )}
    </div>
  );
}
