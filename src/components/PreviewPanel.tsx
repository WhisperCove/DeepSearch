import { FileText, Code, ImageIcon, Link, File, FolderOpen, Copy, ClipboardCopy } from "lucide-react";
import type { SearchResult, PreviewResult } from "../types";

interface PreviewPanelProps {
  preview: PreviewResult | null;
  result: SearchResult | null;
  onOpenFolder?: (path: string) => void;
  onCopyPath?: (path: string) => void;
  onCopyContent?: (content: string) => void;
}

const PREVIEWABLE_EXTS = [
  "txt", "md", "log", "json", "xml", "yaml", "yml", "toml",
  "js", "jsx", "ts", "tsx", "py", "rs", "go", "java", "cpp", "c", "h", "hpp",
  "css", "html", "htm", "scss", "less", "sh", "bash", "ps1", "bat", "cmd",
  "sql", "r", "lua", "vim", "ini", "cfg", "conf", "env"
];

const CODE_EXTS = [
  "js", "jsx", "ts", "tsx", "py", "rs", "go", "java", "cpp", "c", "h", "hpp",
  "css", "html", "htm", "scss", "less", "sh", "bash", "ps1", "bat", "cmd",
  "sql", "r", "lua", "vim", "json", "xml", "yaml", "yml", "toml"
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return "未知";
  return new Date(timestamp * 1000).toLocaleString("zh-CN");
}

function getLanguageName(ext: string): string {
  const langMap: Record<string, string> = {
    js: "JavaScript", jsx: "React JSX", ts: "TypeScript", tsx: "React TSX",
    py: "Python", rs: "Rust", go: "Go", java: "Java",
    cpp: "C++", c: "C", h: "C Header", hpp: "C++ Header",
    css: "CSS", scss: "SCSS", less: "Less",
    html: "HTML", htm: "HTML", xml: "XML",
    json: "JSON", yaml: "YAML", yml: "YAML", toml: "TOML",
    sh: "Shell", bash: "Bash", ps1: "PowerShell", bat: "Batch", cmd: "Command",
    sql: "SQL", r: "R", lua: "Lua", vim: "Vim",
    md: "Markdown", txt: "Plain Text", log: "Log",
    ini: "INI", cfg: "Config", conf: "Config", env: "Environment",
  };
  return langMap[ext] || ext.toUpperCase();
}

function renderCodeWithLineNumbers(content: string): JSX.Element {
  const lines = content.split('\n').slice(0, 100);
  return (
    <div className="code-block">
      {lines.map((line, index) => (
        <div key={index} className="flex">
          <span className="code-line-number">{index + 1}</span>
          <span className="flex-1">{line || '\n'}</span>
        </div>
      ))}
      {content.split('\n').length > 100 && (
        <div className="text-gray-500 mt-2">... 共 {content.split('\n').length} 行</div>
      )}
    </div>
  );
}

function renderTextContent(content: string): JSX.Element {
  return (
    <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
      {content.slice(0, 3000)}
      {content.length > 3000 && (
        <div className="text-gray-400 mt-2">... 共 {content.length} 字符</div>
      )}
    </div>
  );
}

export function PreviewPanel({ preview, result, onOpenFolder, onCopyPath, onCopyContent }: PreviewPanelProps) {
  if (!result) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900">
        <div className="text-center text-gray-400">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium">选择文件预览</p>
          <p className="text-sm mt-1">点击左侧搜索结果查看内容</p>
        </div>
      </div>
    );
  }

  const canPreview = PREVIEWABLE_EXTS.includes(result.ext);
  const isCode = CODE_EXTS.includes(result.ext);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="flex-none px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              {isCode ? (
                <Code className="w-4 h-4 text-blue-500" />
              ) : (
                <FileText className="w-4 h-4 text-gray-400" />
              )}
              <span className="font-medium text-sm truncate">{result.name}</span>
            </div>
            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
              {getLanguageName(result.ext)}
            </span>
          </div>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto min-h-0 p-4">
        {canPreview && preview ? (
          isCode ? (
            renderCodeWithLineNumbers(preview.content)
          ) : (
            renderTextContent(preview.content)
          )
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <FileText className="w-20 h-20 mx-auto mb-4 opacity-15" />
              <p className="text-base font-medium text-gray-500">不支持预览此格式</p>
              <p className="text-sm mt-2 text-gray-400">.{result.ext} 文件</p>
              <p className="text-xs mt-1 text-gray-300">可使用系统默认程序打开</p>
            </div>
          </div>
        )}
      </div>

      {/* Metadata and actions */}
      <div className="flex-none px-5 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 w-12">路径</span>
            <span className="truncate text-gray-700 dark:text-gray-300">{result.path}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 w-12">大小</span>
            <span className="text-gray-700 dark:text-gray-300">{formatFileSize(result.size)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 w-12">类型</span>
            <span className="text-gray-700 dark:text-gray-300">.{result.ext}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400 w-12">修改</span>
            <span className="text-gray-700 dark:text-gray-300">{formatDate(result.modifiedAt)}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {onOpenFolder && (
            <button
              onClick={() => onOpenFolder(result.path)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-gray-300 dark:hover:border-gray-600 active:bg-gray-100 dark:active:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all duration-150 rounded-lg shadow-sm hover:shadow"
            >
              <FolderOpen className="w-4 h-4" />
              打开文件夹
            </button>
          )}
          {onCopyPath && (
            <button
              onClick={() => onCopyPath(result.path)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-gray-300 dark:hover:border-gray-600 active:bg-gray-100 dark:active:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all duration-150 rounded-lg shadow-sm hover:shadow"
            >
              <Copy className="w-4 h-4" />
              复制路径
            </button>
          )}
          {onCopyContent && preview && canPreview && (
            <button
              onClick={() => onCopyContent(preview.content)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 hover:border-gray-300 dark:hover:border-gray-600 active:bg-gray-100 dark:active:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all duration-150 rounded-lg shadow-sm hover:shadow"
            >
              <ClipboardCopy className="w-4 h-4" />
              复制内容
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
