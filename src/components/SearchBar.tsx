import { useState, useRef, useEffect } from "react";
import { Search, Loader2, RefreshCw } from "lucide-react";

interface SearchBarProps {
  query: string;
  onSearch: (query: string) => void;
  onRefresh?: () => void;
  isLoading: boolean;
}

export function SearchBar({ query, onSearch, onRefresh, isLoading }: SearchBarProps) {
  const [inputValue, setInputValue] = useState(query);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleChange = (value: string) => {
    setInputValue(value);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      console.log("[SEARCH] Triggering search:", value);
      onSearch(value);
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      console.log("[SEARCH] Enter pressed, searching:", inputValue);
      onSearch(inputValue);
    }
  };

  const handleRefresh = () => {
    console.log("[SEARCH] Refresh button clicked");
    if (onRefresh) {
      onRefresh();
    }
    // Re-trigger search
    if (inputValue.trim()) {
      onSearch(inputValue);
    }
  };

  return (
    <div className="relative">
      <div className={`flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-2 transition-all duration-200 rounded-lg ${
        isFocused 
          ? "border-blue-500 dark:border-blue-400 shadow-lg shadow-blue-500/20" 
          : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
      }`}>
        {isLoading ? (
          <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
        ) : (
          <Search className="w-5 h-5 text-gray-400" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="搜索文件..."
          className="flex-1 bg-transparent outline-none text-sm"
        />
        
        {/* Refresh button */}
        <button
          onClick={handleRefresh}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
          title="刷新索引"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <kbd className={`hidden sm:inline-flex items-center px-2 py-1 text-xs rounded transition-colors ${
          isFocused 
            ? "text-blue-500 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700" 
            : "text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
        }`}>
          Ctrl+K
        </kbd>
      </div>
    </div>
  );
}
