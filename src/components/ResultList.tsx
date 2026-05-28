import { Loader2 } from "lucide-react";
import type { SearchResult } from "../types";

interface ResultListProps {
  results: SearchResult[];
  selectedId?: number;
  onSelect: (result: SearchResult) => void;
  isLoading: boolean;
  onOpenFolder: (path: string) => void;
  onCopyPath: (path: string) => void;
}

const DOCUMENT_EXTS = ["txt", "md", "log", "doc", "docx", "pdf"];
const SPREADSHEET_EXTS = ["csv", "xls", "xlsx"];
const CODE_EXTS = ["js", "ts", "py", "rs", "go", "java", "cpp", "c", "css", "html", "json", "xml", "yaml"];
const SHORTCUT_EXTS = ["lnk", "url"];

function getFileEmoji(ext: string): string {
  const lower = ext.toLowerCase();
  if (DOCUMENT_EXTS.includes(lower)) return "📄";
  if (SPREADSHEET_EXTS.includes(lower)) return "📊";
  if (CODE_EXTS.includes(lower)) return "💻";
  if (SHORTCUT_EXTS.includes(lower)) return "🔗";
  return "📦";
}

function getFileCategory(ext: string): string {
  const lower = ext.toLowerCase();
  if (DOCUMENT_EXTS.includes(lower)) return "文档类";
  if (SPREADSHEET_EXTS.includes(lower)) return "表格类";
  if (CODE_EXTS.includes(lower)) return "代码类";
  if (SHORTCUT_EXTS.includes(lower)) return "快捷方式";
  return "其他";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ResultList({ results, selectedId, onSelect, isLoading, onOpenFolder, onCopyPath }: ResultListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <span className="text-5xl mb-4 opacity-50">🔍</span>
        <p className="text-lg font-medium">暂无搜索结果</p>
        <p className="text-sm">输入关键词开始搜索</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100 dark:divide-gray-800">
      {results.map((result) => (
        <div
          key={result.id}
          onClick={() => onSelect(result)}
          className={`px-4 py-3 cursor-pointer transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-800 ${
            selectedId === result.id
              ? "bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-500"
              : ""
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg flex-shrink-0" title={getFileCategory(result.ext)}>
              {getFileEmoji(result.ext)}
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
              {result.name}
            </span>
            <span className="text-xs text-gray-500 ml-auto flex-shrink-0">
              {formatFileSize(result.size)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-500">
            <span className="truncate flex-1">{result.path}</span>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFolder(result.path);
                }}
                className="px-1.5 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="打开文件夹"
              >
                📂 打开文件夹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyPath(result.path);
                }}
                className="px-1.5 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="复制路径"
              >
                📋 复制路径
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
