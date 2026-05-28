import { useState, useCallback } from "react";
import { SearchBar } from "./components/SearchBar";
import { ResultList } from "./components/ResultList";
import { PreviewPanel } from "./components/PreviewPanel";
import { FilterBar } from "./components/FilterBar";
import { StatusBar } from "./components/StatusBar";
import { useSearch } from "./hooks/useSearch";
import type { SearchResult, PreviewResult, FilterType } from "./types";

const FILTER_EXT_MAP: Record<string, string[]> = {
  document: ["txt", "md", "log", "doc", "docx", "pdf"],
  spreadsheet: ["csv", "xls", "xlsx"],
  code: ["js", "ts", "py", "rs", "go", "java", "cpp", "c", "css", "html", "json", "xml", "yaml"],
  shortcut: ["lnk", "url"],
  other: ["exe", "dll", "ini", "cfg"],
};

function App() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [copyNotification, setCopyNotification] = useState<string | null>(null);

  const { searchQuery, previewFile, openFolder, copyPath } = useSearch();

  const showNotification = useCallback((msg: string) => {
    setCopyNotification(msg);
    setTimeout(() => setCopyNotification(null), 2000);
  }, []);

  const handleSearch = useCallback(
    async (searchQueryStr: string) => {
      setQuery(searchQueryStr);
      if (!searchQueryStr.trim()) {
        setResults([]);
        return;
      }

      setIsLoading(true);
      try {
        const searchResults = await searchQuery(searchQueryStr, 1, 50);
        setResults(searchResults);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    },
    [searchQuery],
  );

  // Filter results client-side based on active filter
  const filteredResults = activeFilter === "all"
    ? results
    : results.filter((r) => (FILTER_EXT_MAP[activeFilter] ?? []).includes(r.ext.toLowerCase()));

  const handleFilterChange = useCallback((filter: FilterType) => {
    setActiveFilter(filter);
  }, []);

  const handleSelectResult = useCallback(
    async (result: SearchResult) => {
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
    },
    [previewFile],
  );

  const handleOpenFolder = useCallback(
    (path: string) => {
      openFolder(path);
    },
    [openFolder],
  );

  const handleCopyPath = useCallback(
    async (path: string) => {
      const ok = await copyPath(path);
      if (ok) showNotification("路径已复制到剪贴板");
    },
    [copyPath, showNotification],
  );

  const handleCopyContent = useCallback(
    async (content: string) => {
      try {
        await navigator.clipboard.writeText(content);
        showNotification("内容已复制到剪贴板");
      } catch {
        showNotification("复制失败");
      }
    },
    [showNotification],
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Notification */}
      {copyNotification && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 bg-green-500 text-white text-sm rounded-lg shadow-lg animate-fade-in">
          {copyNotification}
        </div>
      )}

      <div className="flex-none p-4 border-b border-gray-200 dark:border-gray-700">
        <SearchBar query={query} onSearch={handleSearch} isLoading={isLoading} />
      </div>

      <div className="flex-none px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <FilterBar activeFilter={activeFilter} onFilterChange={handleFilterChange} results={results} />
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/2 overflow-y-auto border-r border-gray-200 dark:border-gray-700">
          <ResultList
            results={filteredResults}
            selectedId={selectedResult?.id}
            onSelect={handleSelectResult}
            isLoading={isLoading}
            onOpenFolder={handleOpenFolder}
            onCopyPath={handleCopyPath}
          />
        </div>

        <div className="w-1/2 overflow-y-auto">
          <PreviewPanel
            preview={preview}
            result={selectedResult}
            onOpenFolder={handleOpenFolder}
            onCopyPath={handleCopyPath}
            onCopyContent={handleCopyContent}
          />
        </div>
      </div>

      <div className="flex-none border-t border-gray-200 dark:border-gray-700">
        <StatusBar />
      </div>
    </div>
  );
}

export default App;
