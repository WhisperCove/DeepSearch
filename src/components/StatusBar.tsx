import { useState, useEffect } from "react";
import { Database, Clock, FolderOpen, Loader2 } from "lucide-react";
import { useSearch } from "../hooks/useSearch";
import type { IndexStatus } from "../types";

export function StatusBar() {
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const { getIndexStatus, createIndex } = useSearch();

  const refreshStatus = async () => {
    const s = await getIndexStatus();
    if (s) setStatus(s);
  };

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectDir = async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: true,
        title: "选择要索引的目录",
      });
      if (selected) {
        const paths = Array.isArray(selected) ? selected : [selected];
        await createIndex(paths);
        await refreshStatus();
      }
    } catch (error) {
      console.error("Failed to select directory:", error);
    }
  };

  if (!status) return null;

  const lastUpdateStr =
    status.lastUpdated > 0
      ? new Date(status.lastUpdated * 1000).toLocaleTimeString("zh-CN")
      : "未索引";

  return (
    <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          {status.isIndexing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
          ) : (
            <Database className="w-3.5 h-3.5" />
          )}
          <span>
            {status.isIndexing
              ? "索引中..."
              : `已索引 ${status.totalFiles.toLocaleString()} 个文件`}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          <span>最后更新：{lastUpdateStr}</span>
        </div>

        <button
          onClick={handleSelectDir}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          title="添加索引目录"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>添加目录</span>
        </button>
      </div>

      <div className="text-gray-400">LocalSearch Pro v0.1.0</div>
    </div>
  );
}
