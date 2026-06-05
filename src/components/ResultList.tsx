import { FileText, Code, ImageIcon, Film, Link, File, FolderOpen, Copy } from "lucide-react";
import type { SearchResult } from "../types";

interface ResultListProps {
  results: SearchResult[];
  selectedId?: string;
  onSelect: (result: SearchResult) => void;
  isLoading: boolean;
  onOpenFolder?: (path: string) => void;
  onCopyPath?: (path: string) => void;
}

function getExtCategory(ext: string): string {
  const documentExts = ["txt", "md", "log", "doc", "docx", "pdf", "rtf", "odt", "ods", "odp", "ppt", "pptx", "xls", "xlsx", "csv"];
  const codeExts = ["js", "jsx", "ts", "tsx", "py", "rs", "go", "java", "cpp", "c", "h", "hpp", "css", "html", "json", "xml", "yaml", "yml", "toml", "sh", "bat", "cmd", "sql", "ini", "cfg"];
  const imageExts = ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif"];
  const videoExts = ["mp4", "avi", "mov", "mkv", "wmv", "flv", "webm", "m4v", "3gp", "mpg", "mpeg"];
  const shortcutExts = ["lnk", "url"];
  
  if (documentExts.includes(ext)) return "document";
  if (codeExts.includes(ext)) return "code";
  if (imageExts.includes(ext)) return "image";
  if (videoExts.includes(ext)) return "video";
  if (shortcutExts.includes(ext)) return "shortcut";
  return "other";
}

function getFileIcon(ext: string) {
  const category = getExtCategory(ext);
  const iconClass = "w-4 h-4";
  switch (category) {
    case "document": return <FileText className={iconClass} />;
    case "code": return <Code className={iconClass} />;
    case "image": return <ImageIcon className={iconClass} />;
    case "video": return <Film className={iconClass} />;
    case "shortcut": return <Link className={iconClass} />;
    default: return <File className={iconClass} />;
  }
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
        <div className="text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm">搜索中...</p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium">暂无搜索结果</p>
          <p className="text-sm mt-1">输入关键词开始搜索</p>
        </div>
      </div>
    );
  }

  return (
    <div className="py-2">
      {results.map((result) => (
        <div
          key={result.id}
          onClick={() => onSelect(result)}
          className={`group flex items-center gap-3 px-4 py-3 cursor-pointer transition-all duration-150 ${
            selectedId === result.id
              ? "bg-blue-50 dark:bg-blue-900/20 border-l-3 border-blue-500"
              : "hover:bg-white dark:hover:bg-gray-800 border-l-3 border-transparent"
          }`}
        >
          <span className="text-gray-400 dark:text-gray-500 flex-shrink-0">
            {getFileIcon(result.ext)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{result.name}</div>
            <div className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{result.path}</div>
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
            {formatFileSize(result.size)}
          </span>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {onOpenFolder && (
              <button
                onClick={(e) => { e.stopPropagation(); onOpenFolder(result.path); }}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 rounded-md transition-colors duration-150"
                title="打开文件夹"
              >
                <FolderOpen className="w-3.5 h-3.5 text-gray-500" />
              </button>
            )}
            {onCopyPath && (
              <button
                onClick={(e) => { e.stopPropagation(); onCopyPath(result.path); }}
                className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 active:bg-gray-300 dark:active:bg-gray-600 rounded-md transition-colors duration-150"
                title="复制路径"
              >
                <Copy className="w-3.5 h-3.5 text-gray-500" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
