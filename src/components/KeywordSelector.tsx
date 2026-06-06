"use client";

import { KeywordGroup } from "@/types";

interface Props {
  groups: KeywordGroup[];
  selected: string[];
  onToggle: (keyword: string) => void;
}

export default function KeywordSelector({ groups, selected, onToggle }: Props) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.id}>
          <h3 className="text-sm font-medium text-app-text3 mb-2">{group.name}</h3>
          <div className="flex flex-wrap gap-2">
            {group.keywords.map((kw) => {
              const active = selected.includes(kw.name);
              return (
                <button
                  key={kw.id}
                  onClick={() => onToggle(kw.name)}
                  className="px-3 py-1.5 rounded-full text-sm border transition-all"
                  style={{
                    background: active ? "var(--accent)" : "var(--bg-tertiary)",
                    borderColor: active ? "var(--accent)" : "var(--border)",
                    color: active ? "#fff" : "var(--text-secondary)",
                    boxShadow: active ? "0 0 12px var(--accent-glow)" : "none",
                  }}
                >
                  {kw.name}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
