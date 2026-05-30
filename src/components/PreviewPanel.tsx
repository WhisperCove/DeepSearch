import { useState, useEffect, useRef } from "react";
import { FileText, Code, ImageIcon, Link, File, FolderOpen, Copy, ClipboardCopy } from "lucide-react";
import type { SearchResult, PreviewResult } from "../types";

interface PreviewPanelProps {
  preview: PreviewResult | null;
  result: SearchResult | null;
  onOpenFolder?: (path: string) => void;
  onCopyPath?: (path: string) => void;
  onCopyContent?: (content: string) => void;
}

const PREVIEWABLE_TEXT_EXTS = [
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

const PDF_EXTS = ["pdf"];
const DOCX_EXTS = ["docx", "doc"];
const IMAGE_EXTS = ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif"];

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
    pdf: "PDF 文档", docx: "Word 文档", doc: "Word 文档",
    png: "PNG 图片", jpg: "JPEG 图片", jpeg: "JPEG 图片",
    gif: "GIF 图片", bmp: "BMP 图片", webp: "WebP 图片",
    svg: "SVG 图片", ico: "ICO 图片", tiff: "TIFF 图片", tif: "TIFF 图片",
  };
  return langMap[ext] || ext.toUpperCase();
}

// PDF Preview Component
function PdfPreview({ base64Content }: { base64Content: string }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const binaryString = atob(base64Content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      return () => URL.revokeObjectURL(url);
    } catch (e) {
      setError("PDF 解析失败");
    }
  }, [base64Content]);

  if (error) {
    return <div className="text-center text-red-500 p-8">{error}</div>;
  }

  if (!pdfUrl) {
    return <div className="text-center text-gray-400 p-8">加载中...</div>;
  }

  return (
    <iframe
      src={pdfUrl}
      className="w-full h-full border-0"
      title="PDF Preview"
    />
  );
}

// DOCX Preview Component
function DocxPreview({ base64Content, ext }: { base64Content: string; ext: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // .doc format is not supported by mammoth.js, only .docx
    if (ext === "doc") {
      setLoading(false);
      return;
    }

    const loadMammoth = async () => {
      try {
        const mammoth = await import("mammoth");
        const binaryString = atob(base64Content);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const result = await mammoth.convertToHtml({ arrayBuffer: bytes.buffer });
        setHtml(result.value);
      } catch (e) {
        setError("DOCX 解析失败");
      } finally {
        setLoading(false);
      }
    };
    loadMammoth();
  }, [base64Content, ext]);

  if (loading) {
    return <div className="text-center text-gray-400 p-8">加载中...</div>;
  }

  if (ext === "doc") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium text-gray-500">旧版 Word 文档</p>
          <p className="text-sm mt-2 text-gray-400">.doc 格式需要转换为 .docx 才能预览</p>
          <p className="text-xs mt-1 text-gray-300">请使用 Word 或 LibreOffice 转换格式</p>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500 p-8">{error}</div>;
  }

  return (
    <div
      className="prose dark:prose-invert max-w-none p-4"
      dangerouslySetInnerHTML={{ __html: html || "" }}
    />
  );
}

// Image Preview Component
function ImagePreview({ base64Content, ext }: { base64Content: string; ext: string }) {
  const mimeTypeMap: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    bmp: "image/bmp",
    webp: "image/webp",
    svg: "image/svg+xml",
    ico: "image/x-icon",
    tiff: "image/tiff",
    tif: "image/tiff",
  };

  const mimeType = mimeTypeMap[ext] || "image/png";
  const dataUrl = `data:${mimeType};base64,${base64Content}`;

  return (
    <div className="flex items-center justify-center h-full p-4">
      <img
        src={dataUrl}
        alt="Preview"
        className="max-w-full max-h-full object-contain"
        style={{ maxHeight: "calc(100vh - 300px)" }}
      />
    </div>
  );
}

// Text/Code Preview
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

  const isText = PREVIEWABLE_TEXT_EXTS.includes(result.ext);
  const isCode = CODE_EXTS.includes(result.ext);
  const isPdf = PDF_EXTS.includes(result.ext);
  const isDocx = DOCX_EXTS.includes(result.ext);
  const isImage = IMAGE_EXTS.includes(result.ext);
  const canPreview = isText || isPdf || isDocx || isImage;

  const renderPreview = () => {
    if (!preview) return null;

    if (isPdf) {
      return <PdfPreview base64Content={preview.content} />;
    }

    if (isDocx) {
      return <DocxPreview base64Content={preview.content} ext={result.ext} />;
    }

    if (isImage) {
      return <ImagePreview base64Content={preview.content} ext={result.ext} />;
    }

    if (isCode) {
      return renderCodeWithLineNumbers(preview.content);
    }

    if (isText) {
      return renderTextContent(preview.content);
    }

    return null;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-950">
      {/* Header */}
      <div className="flex-none px-5 py-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2">
              {isCode ? (
                <Code className="w-4 h-4 text-blue-500" />
              ) : isImage ? (
                <ImageIcon className="w-4 h-4 text-green-500" />
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
      <div className="flex-1 overflow-auto min-h-0">
        {canPreview && preview ? (
          renderPreview()
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
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-700 hover:text-blue-600 dark:hover:text-blue-400 active:bg-blue-100 dark:active:bg-blue-900/30 text-gray-700 dark:text-gray-300 transition-all duration-150 rounded-lg shadow-sm hover:shadow-md"
            >
              <FolderOpen className="w-4 h-4" />
              打开文件夹
            </button>
          )}
          {onCopyPath && (
            <button
              onClick={() => onCopyPath(result.path)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-700 hover:text-green-600 dark:hover:text-green-400 active:bg-green-100 dark:active:bg-green-900/30 text-gray-700 dark:text-gray-300 transition-all duration-150 rounded-lg shadow-sm hover:shadow-md"
            >
              <Copy className="w-4 h-4" />
              复制路径
            </button>
          )}
          {onCopyContent && preview && (isText || isCode) && (
            <button
              onClick={() => onCopyContent(preview.content)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-700 hover:text-purple-600 dark:hover:text-purple-400 active:bg-purple-100 dark:active:bg-purple-900/30 text-gray-700 dark:text-gray-300 transition-all duration-150 rounded-lg shadow-sm hover:shadow-md"
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
