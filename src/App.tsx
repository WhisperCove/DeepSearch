import { useState, useCallback, useEffect } from "react";
import { SearchBar } from "./components/SearchBar";
import { ResultList } from "./components/ResultList";
import { PreviewPanel } from "./components/PreviewPanel";
import { FilterBar } from "./components/FilterBar";
import { StatusBar } from "./components/StatusBar";
import { useSearch } from "./hooks/useSearch";
import type { SearchResult, PreviewResult, FilterType } from "./types";

const FILTER_EXT_MAP: Record<string, string[]> = {
  document: ["txt", "md", "log", "doc", "docx", "pdf", "rtf", "odt", "ods", "odp", "ppt", "pptx", "xls", "xlsx", "csv"],
  code: ["js", "jsx", "ts", "tsx", "py", "rs", "go", "java", "cpp", "c", "h", "hpp", "css", "html", "json", "xml", "yaml", "yml", "toml", "sh", "bat", "cmd", "sql", "ini", "cfg"],
  image: ["png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif"],
  shortcut: ["lnk", "url"],
};

function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const { searchQuery, previewFile, openFolder, copyPath } = useSearch();

  // Toast auto-hide
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
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
      showToast("路径已复制到剪贴板");
    } catch (error) {
      showToast("复制路径失败", "error");
    }
  }, [copyPath]);

  const handleCopyContent = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      showToast("内容已复制到剪贴板");
    } catch (error) {
      showToast("复制内容失败", "error");
    }
  }, []);

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
    <div className="h-screen w-screen flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 shadow-2xl">
      {/* Search bar */}
      <div className="flex-none px-6 pt-6 pb-4">
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

      {/* Toast notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg border transition-all duration-300 ${
          toast.type === "success" 
            ? "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200" 
            : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
        }`}>
          <div className="flex items-center gap-2">
            {toast.type === "success" ? (
              <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="text-sm font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
