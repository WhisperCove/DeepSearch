import { useState, useRef, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import clsx from "clsx";

interface SearchBarProps {
  query: string;
  onSearch: (query: string) => void;
  isLoading: boolean;
}

export function SearchBar({ query, onSearch, isLoading }: SearchBarProps) {
  const [inputValue, setInputValue] = useState(query);
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
      onSearch(value);
    }, 300);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      onSearch(inputValue);
    }
  };

  return (
    <div className="relative max-w-3xl mx-auto">
      <div
        className={clsx(
          "flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-fast",
          "bg-white dark:bg-gray-800",
          "border-gray-200 dark:border-gray-600",
          "focus-within:border-blue-500 dark:focus-within:border-blue-400",
          "shadow-sm focus-within:shadow-md",
        )}
      >
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
          placeholder="搜索文件内容... (Ctrl+K)"
          className={clsx(
            "flex-1 bg-transparent outline-none text-base",
            "placeholder:text-gray-400 dark:placeholder:text-gray-500",
          )}
        />
        <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-xs text-gray-500 bg-gray-100 dark:bg-gray-700 rounded">
          Ctrl+K
        </kbd>
      </div>
    </div>
  );
}
