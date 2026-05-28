import { Loader2 } from "lucide-react";
import type { SearchResult, PreviewResult } from "../types";

interface PreviewPanelProps {
  preview: PreviewResult | null;
  result: SearchResult | null;
  onOpenFolder: (path: string) => void;
  onCopyPath: (path: string) => void;
  onCopyContent: (content: string) => void;
}

const DOCUMENT_EXTS = ["txt", "md", "log"];
const SPREADSHEET_EXTS = ["csv", "xls", "xlsx"];
const CODE_EXTS = ["js", "ts", "py", "rs", "go", "java", "cpp", "c", "css", "html", "json", "xml", "yaml"];
const SHORTCUT_EXTS = ["lnk", "url"];

function getFileEmoji(ext: string): string {
  const lower = ext.toLowerCase();
  if (DOCUMENT_EXTS.includes(lower) || ["doc", "docx", "pdf"].includes(lower)) return "📄";
  if (SPREADSHEET_EXTS.includes(lower)) return "📊";
  if (CODE_EXTS.includes(lower)) return "💻";
  if (SHORTCUT_EXTS.includes(lower)) return "🔗";
  return "📦";
}

function getPreviewCategory(ext: string): "document" | "spreadsheet" | "code" | "shortcut" | "other" {
  const lower = ext.toLowerCase();
  if (DOCUMENT_EXTS.includes(lower)) return "document";
  if (SPREADSHEET_EXTS.includes(lower)) return "spreadsheet";
  if (CODE_EXTS.includes(lower)) return "code";
  if (SHORTCUT_EXTS.includes(lower)) return "shortcut";
  return "other";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString("zh-CN");
}

function renderDocumentPreview(content: string) {
  const truncated = content.slice(0, 2000);
  return (
    <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-gray-800 dark:text-gray-200">
      {truncated}
      {content.length > 2000 && (
        <span className="text-gray-400 italic">{"\n"}... (显示前 2000 字符)</span>
      )}
    </pre>
  );
}

function renderSpreadsheetPreview(content: string) {
  const lines = content.split("\n").slice(0, 20);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-gray-50 dark:bg-gray-800/50" : ""}>
              <td className="px-2 py-1 text-xs text-gray-400 border-r border-gray-200 dark:border-gray-700 w-10 text-right">
                {i + 1}
              </td>
              <td className="px-2 py-1 font-mono text-xs text-gray-700 dark:text-gray-300">
                {line}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {content.split("\n").length > 20 && (
        <p className="text-xs text-gray-400 italic mt-2">
          ... (显示前 20 行，共 {content.split("\n").length} 行)
        </p>
      )}
    </div>
  );
}

function renderCodePreview(content: string) {
  const lines = content.split("\n").slice(0, 100);
  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <pre className="p-4 text-sm">
          {lines.map((line, i) => (
            <div key={i} className="flex">
              <span className="text-gray-500 select-none w-10 text-right pr-4 flex-shrink-0">
                {i + 1}
              </span>
              <code className="text-gray-100 font-mono">{line}</code>
            </div>
          ))}
        </pre>
      </div>
      {content.split("\n").length > 100 && (
        <div className="px-4 py-2 bg-gray-800 text-xs text-gray-400">
          ... (显示前 100 行，共 {content.split("\n").length} 行)
        </div>
      )}
    </div>
  );
}

function renderShortcutPreview(name: string, content: string) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <span className="text-2xl">🔗</span>
        <div>
          <p className="font-medium text-gray-900 dark:text-gray-100">{name}</p>
          <p className="text-xs text-gray-500">快捷方式</p>
        </div>
      </div>
      {content && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-xs text-gray-500 mb-1">目标路径：</p>
          <p className="font-mono text-sm text-gray-700 dark:text-gray-300 break-all">{content}</p>
        </div>
      )}
    </div>
  );
}

function renderOtherPreview() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
      <span className="text-5xl mb-4">📦</span>
      <p className="text-lg font-medium">不支持预览此格式</p>
      <p className="text-sm">此文件类型暂不支持内容预览</p>
    </div>
  );
}

export function PreviewPanel({ preview, result, onOpenFolder, onCopyPath, onCopyContent }: PreviewPanelProps) {
  if (!result) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <span className="text-5xl mb-4 opacity-50">📄</span>
        <p className="text-lg font-medium">选择文件预览</p>
        <p className="text-sm">点击左侧搜索结果查看内容</p>
      </div>
    );
  }

  const category = getPreviewCategory(result.ext);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getFileEmoji(result.ext)}</span>
          <span className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate max-w-[300px]">
            {result.name}
          </span>
          <span className="text-xs text-gray-500">{formatFileSize(result.size)}</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {preview ? (
          <div>
            {category === "document" && renderDocumentPreview(preview.content)}
            {category === "spreadsheet" && renderSpreadsheetPreview(preview.content)}
            {category === "code" && renderCodePreview(preview.content)}
            {category === "shortcut" && renderShortcutPreview(result.name, preview.content)}
            {category === "other" && renderOtherPreview()}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        )}
      </div>

      {/* Metadata */}
      <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 mb-3">
          <div>
            <span className="font-medium">路径：</span>
            <span className="truncate block">{result.path}</span>
          </div>
          <div>
            <span className="font-medium">修改时间：</span>
            <span>{formatDate(result.modifiedAt)}</span>
          </div>
          <div>
            <span className="font-medium">类型：</span>
            <span>.{result.ext}</span>
          </div>
          <div>
            <span className="font-medium">大小：</span>
            <span>{formatFileSize(result.size)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onOpenFolder(result.path)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            📂 打开文件所在文件夹
          </button>
          <button
            onClick={() => onCopyPath(result.path)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
          >
            📋 复制文件路径
          </button>
          {preview && category !== "other" && (
            <button
              onClick={() => onCopyContent(preview.content)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors"
            >
              📄 复制文件内容
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
