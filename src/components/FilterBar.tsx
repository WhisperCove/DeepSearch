import type { FilterType, SearchResult } from "../types";

interface FilterBarProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  results: SearchResult[];
}

const FILTER_CONFIG: { key: FilterType; label: string; emoji: string; exts: string[] }[] = [
  { key: "all", label: "全部", emoji: "📁", exts: [] },
  { key: "document", label: "文档", emoji: "📄", exts: ["txt", "md", "log", "doc", "docx", "pdf"] },
  { key: "spreadsheet", label: "表格", emoji: "📊", exts: ["csv", "xls", "xlsx"] },
  { key: "code", label: "代码", emoji: "💻", exts: ["js", "ts", "py", "rs", "go", "java", "cpp", "c", "css", "html", "json", "xml", "yaml"] },
  { key: "shortcut", label: "快捷方式", emoji: "🔗", exts: ["lnk", "url"] },
  { key: "other", label: "其他", emoji: "📦", exts: ["exe", "dll", "ini", "cfg"] },
];

export function FilterBar({ activeFilter, onFilterChange, results }: FilterBarProps) {
  function getCount(filter: { key: FilterType; exts: string[] }): number {
    if (filter.key === "all") return results.length;
    return results.filter((r) => filter.exts.includes(r.ext.toLowerCase())).length;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {FILTER_CONFIG.map((filter) => {
        const count = getCount(filter);
        return (
          <button
            key={filter.key}
            onClick={() => onFilterChange(filter.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-150 ${
              activeFilter === filter.key
                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium"
                : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
          >
            <span>{filter.emoji}</span>
            <span>{filter.label}</span>
            {results.length > 0 && (
              <span className="text-xs opacity-70">({count})</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
