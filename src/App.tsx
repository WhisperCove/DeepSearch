import { useState, useCallback, useEffect, useRef } from "react";
import { SplashScreen } from "./components/SplashScreen";
import { FirstRunWizard } from "./components/FirstRunWizard";
import { SearchBar } from "./components/SearchBar";
import { ResultList } from "./components/ResultList";
import { PreviewPanel } from "./components/PreviewPanel";
import { FilterBar } from "./components/FilterBar";
import { StatusBar } from "./components/StatusBar";
import { useSearch } from "./hooks/useSearch";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { SearchResult, PreviewResult, FilterType } from "./types";

const FILTER_EXT_MAP: Record<string, string[]> = {
  document: ["txt", "md", "log", "doc", "docx", "pdf", "rtf", "odt", "ods", "odp", "ppt", "pptx", "xls", "xlsx", "csv"],
  code: ["js", "jsx", "ts", "tsx", "py", "rs", "go", "java", "cpp", "c", "h", "hpp", "css", "html", "json", "xml", "yaml", "yml", "toml", "sh", "bat", "cmd", "sql", "ini", "cfg"],
  image: ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif"],
  video: ["mp4", "avi", "mov", "mkv", "wmv", "flv", "webm", "m4v", "3gp", "mpg", "mpeg"],
  shortcut: ["lnk", "url"],
};

function App() {
  const [appState, setAppState] = useState<"splash" | "wizard" | "ready">("splash");
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [toast, setToast] = useState<{ id: number; message: string; type: "success" | "error" } | null>(null);

  const { searchQuery, previewFile, openFolder, copyPath } = useSearch();

  // Check if first launch (use ref to avoid re-renders)
  const isFirstLaunchRef = useRef(false);
  
  useEffect(() => {
    const hasSeenWizard = localStorage.getItem("hasSeenWizard");
    isFirstLaunchRef.current = !hasSeenWizard;
    setIsFirstLaunch(!hasSeenWizard);
  }, []);

  const handleSplashComplete = useCallback(() => {
    if (isFirstLaunchRef.current) {
      setAppState("wizard");
    } else {
      setAppState("ready");
    }
  }, []);

  const handleWizardComplete = useCallback(() => {
    localStorage.setItem("hasSeenWizard", "true");
    setAppState("ready");
  }, []);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 2200);
  };

  const handleSearch = useCallback(async (searchQueryStr: string) => {
    setQuery(searchQueryStr);
    if (!searchQueryStr.trim()) {
      setResults([]);
      setSelectedResult(null);
      setPreview(null);
      return;
    }
    setIsLoading(true);
    try {
      const searchResults = await searchQuery(searchQueryStr);
      setResults(searchResults);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  const handleFilterChange = useCallback((filter: FilterType) => {
    setActiveFilter(filter);
  }, []);

  const handleSelectResult = useCallback(async (result: SearchResult) => {
    setSelectedResult(result);
    setPreview(null);
    try {
      const previewResult = await previewFile(result.id);
      if (previewResult) {
        setPreview(previewResult);
      }
    } catch (error) {
      console.error("Preview error:", error);
    }
  }, [previewFile]);

  const handleOpenFolder = useCallback(async (path: string) => {
    try {
      await openFolder(path);
    } catch (error) {
      showToast("打开文件夹失败", "error");
    }
  }, [openFolder]);

  const handleCopyPath = useCallback(async (path: string) => {
    try {
      await copyPath(path);
      showToast("路径已复制");
    } catch (error) {
      showToast("复制失败", "error");
    }
  }, [copyPath]);

  const handleCopyContent = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showToast("内容已复制");
    } catch (error) {
      showToast("复制失败", "error");
    }
  }, []);

  const handleMinimize = useCallback(async () => {
    try {
      await getCurrentWindow().minimize();
    } catch (error) {
      console.error("Minimize failed:", error);
    }
  }, []);

  const handleMaximize = useCallback(async () => {
    try {
      const appWindow = getCurrentWindow();
      const isMaximized = await appWindow.isMaximized();
      if (isMaximized) {
        await appWindow.unmaximize();
      } else {
        await appWindow.maximize();
      }
    } catch (error) {
      console.error("Maximize failed:", error);
    }
  }, []);

  const handleClose = useCallback(async () => {
    try {
      await getCurrentWindow().close();
    } catch (error) {
      console.error("Close failed:", error);
    }
  }, []);

  // Show splash screen
  if (appState === "splash") {
    return <SplashScreen isFirstLaunch={isFirstLaunch} onComplete={handleSplashComplete} />;
  }

  // Show first run wizard
  if (appState === "wizard") {
    return <FirstRunWizard onComplete={handleWizardComplete} />;
  }

  const getFilteredResults = () => {
    if (activeFilter === "all") return results;
    if (activeFilter === "other") {
      const allKnownExts = Object.values(FILTER_EXT_MAP).flat();
      return results.filter(r => !allKnownExts.includes(r.ext));
    }
    const exts = FILTER_EXT_MAP[activeFilter] || [];
    return results.filter(r => exts.includes(r.ext));
  };

  const filteredResults = getFilteredResults();

  return (
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-4xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl">
      {/* Title bar */}
      <div data-tauri-drag-region className="flex-none flex items-center justify-between px-4 pt-3 pb-1 select-none" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
        <div className="w-20" />
        <div className="w-20" />
        <div className="flex items-center gap-1 w-20 justify-end" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
          <button onClick={handleMinimize} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded" title="最小化">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M5 12h14" /></svg>
          </button>
          <button onClick={handleMaximize} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors rounded" title="最大化">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="5" y="5" width="14" height="14" rx={1} strokeWidth={2} /></svg>
          </button>
          <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded" title="关闭">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeWidth={2} d="M6 6l12 12M6 18L18 6" /></svg>
          </button>
        </div>
      </div>

      {/* Search bar */}
      <div className="flex-none px-6 pb-4">
        <SearchBar query={query} onSearch={handleSearch} isLoading={isLoading} />
      </div>

      {/* Filter tabs */}
      <div className="flex-none px-6 pb-3">
        <FilterBar activeFilter={activeFilter} onFilterChange={handleFilterChange} results={results} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden min-h-0 border-t border-gray-100 dark:border-gray-800">
        <div className="w-2/5 overflow-y-auto border-r border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
          <ResultList
            results={filteredResults}
            selectedId={selectedResult?.id}
            onSelect={handleSelectResult}
            isLoading={isLoading}
            onOpenFolder={handleOpenFolder}
            onCopyPath={handleCopyPath}
          />
        </div>
        <div className="w-3/5 overflow-y-auto">
          <PreviewPanel
            preview={preview}
            result={selectedResult}
            onOpenFolder={handleOpenFolder}
            onCopyPath={handleCopyPath}
            onCopyContent={handleCopyContent}
          />
        </div>
      </div>

      {/* Status bar */}
      <div className="flex-none border-t border-gray-100 dark:border-gray-800">
        <StatusBar />
      </div>

      {/* Toast */}
      {toast && (
        <div key={toast.id} className="fixed top-32 right-4 z-50" style={{ animation: "toast-in 0.15s ease-out, toast-out 0.3s ease-in 1.8s forwards" }}>
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-sm ${toast.type === "success" ? "bg-white/95 dark:bg-gray-800/95 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200" : "bg-red-50/95 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"}`}>
            {toast.type === "success" ? (
              <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            ) : (
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
            )}
            <span className="text-sm font-medium whitespace-nowrap">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
