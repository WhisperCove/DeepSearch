import { Files, FileText, Code, ImageIcon, Film, Link, Package } from "lucide-react";
import type { FilterType, SearchResult } from "../types";

interface FilterBarProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  results: SearchResult[];
}

const FILTER_CONFIG: { key: FilterType; label: string; icon: React.ReactNode; exts: string[] }[] = [
  { key: "all", label: "全部", icon: <Files className="w-4 h-4" />, exts: [] },
  { key: "document", label: "文档", icon: <FileText className="w-4 h-4" />, exts: ["txt", "md", "log", "doc", "docx", "pdf", "rtf", "odt", "ods", "odp", "ppt", "pptx", "xls", "xlsx", "csv"] },
  { key: "code", label: "代码", icon: <Code className="w-4 h-4" />, exts: ["js", "jsx", "ts", "tsx", "py", "rs", "go", "java", "cpp", "c", "h", "hpp", "css", "html", "json", "xml", "yaml", "yml", "toml", "sh", "bat", "cmd", "sql", "ini", "cfg"] },
  { key: "image", label: "图片", icon: <ImageIcon className="w-4 h-4" />, exts: ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif"] },
  { key: "video", label: "视频", icon: <Film className="w-4 h-4" />, exts: ["mp4", "avi", "mov", "mkv", "wmv", "flv", "webm", "m4v", "3gp", "mpg", "mpeg"] },
  { key: "shortcut", label: "快捷方式", icon: <Link className="w-4 h-4" />, exts: ["lnk", "url"] },
  { key: "other", label: "其他", icon: <Package className="w-4 h-4" />, exts: [] },
];

export function FilterBar({ activeFilter, onFilterChange, results }: FilterBarProps) {
  const getCount = (filter: typeof FILTER_CONFIG[0]) => {
    if (filter.key === "all") return results.length;
    if (filter.key === "other") {
      const allKnownExts = FILTER_CONFIG.flatMap(f => f.exts);
      return results.filter(r => !allKnownExts.includes(r.ext)).length;
    }
    return results.filter(r => filter.exts.includes(r.ext)).length;
  };

  return (
    <div className="flex gap-2">
      {FILTER_CONFIG.map((filter) => {
        const count = getCount(filter);
        const isActive = activeFilter === filter.key;
        return (
          <button
            key={filter.key}
            onClick={() => onFilterChange(filter.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all ${
              isActive
                ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
            }`}
          >
            {filter.icon}
            <span>{filter.label}</span>
            {count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${
                isActive ? "bg-white/20 dark:bg-black/20" : "bg-gray-100 dark:bg-gray-800"
              }`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
