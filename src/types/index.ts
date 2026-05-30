export interface SearchResult {
  id: number;
  name: string;
  path: string;
  ext: string;
  size: number;
  modifiedAt: number;
  score: number;
  snippets: Snippet[];
}

export interface SearchResultResponse {
  results: SearchResult[];
  total: number;
  hasMore: boolean;
}

export interface Snippet {
  text: string;
  highlights: Highlight[];
}

export interface Highlight {
  start: number;
  end: number;
  keyword: string;
  colorIndex: number;
}

export interface PreviewResult {
  type: string;
  content: string;
  language?: string;
  metadata: FileMetadata;
}

export interface FileMetadata {
  id: number;
  name: string;
  path: string;
  ext: string;
  size: number;
  modifiedAt: number;
}

export interface IndexStatus {
  totalFiles: number;
  isIndexing: boolean;
  lastUpdated: number;
}

export interface AppConfig {
  theme: string;
  globalHotkey: string;
  maxResults: number;
  snippetLength: number;
  autoStart: boolean;
}

export type FilterType = "all" | "document" | "code" | "image" | "shortcut" | "other";
