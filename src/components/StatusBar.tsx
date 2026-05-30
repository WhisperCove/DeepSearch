import { useState, useEffect } from "react";
import { Database, Clock } from "lucide-react";
import { useSearch } from "../hooks/useSearch";
import type { IndexStatus } from "../types";

export function StatusBar() {
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const { getIndexStatus } = useSearch();

  const refreshStatus = async () => {
    const s = await getIndexStatus();
    if (s) setStatus(s);
  };

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!status) return null;

  const lastUpdateStr = status.lastUpdated > 0
    ? new Date(status.lastUpdated * 1000).toLocaleTimeString("zh-CN")
    : "未索引";

  return (
    <div className="flex items-center justify-between px-6 py-2.5 text-sm text-gray-500 bg-gray-50 dark:bg-gray-900">
      {/* Left: Index status */}
      <div className="flex items-center gap-6 flex-1">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-gray-400" />
          <span>{status.totalFiles.toLocaleString()} 个文件已索引</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span>最后更新：{lastUpdateStr}</span>
        </div>
      </div>
      
      {/* Center: Repo links */}
      <div className="flex items-center gap-6">
        <a
          href="https://gitee.com/pure_full_of_smile/localsearch-pro"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:underline underline-offset-4 transition-all duration-200 font-medium"
          title="Gitee 仓库"
        >
          Gitee仓库
        </a>
        <a
          href="https://github.com/WhisperCove/localsearch-pro"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:underline underline-offset-4 transition-all duration-200 font-medium"
          title="GitHub 仓库"
        >
          GitHub仓库
        </a>
      </div>

      {/* Right: Version */}
      <div className="flex-1 text-right">
        <span className="text-gray-300 dark:text-gray-600">LocalSearch Pro v0.1.0</span>
      </div>
    </div>
  );
}
