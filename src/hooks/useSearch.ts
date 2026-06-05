import { invoke } from "@tauri-apps/api/core";
import type { SearchResponse, IndexStatus, PreviewResult } from "../types";

export function useSearch() {
  const searchQuery = async (query: string): Promise<SearchResponse> => {
    try {
      return await invoke("search_query", { query });
    } catch (error) {
      console.error("Search failed:", error);
      return { results: [], total: 0, hasMore: false };
    }
  };

  const getIndexStatus = async (): Promise<IndexStatus | null> => {
    try {
      return await invoke("index_status");
    } catch (error) {
      console.error("Get index status failed:", error);
      return null;
    }
  };

  const createIndex = async (paths: string[]): Promise<IndexStatus | null> => {
    try {
      return await invoke("index_create", { paths });
    } catch (error) {
      console.error("Create index failed:", error);
      return null;
    }
  };

  const previewFile = async (fileId: string): Promise<PreviewResult | null> => {
    try {
      return await invoke("preview_file", { fileId });
    } catch (error) {
      console.error("Preview failed:", error);
      return null;
    }
  };

  const openFile = async (path: string): Promise<void> => {
    try {
      await invoke("open_file", { path });
    } catch (error) {
      console.error("Open file failed:", error);
    }
  };

  const openFolder = async (path: string): Promise<void> => {
    try {
      await invoke("open_folder", { path });
    } catch (error) {
      console.error("Open folder failed:", error);
    }
  };

  const copyPath = async (path: string): Promise<void> => {
    try {
      await invoke("copy_path", { path });
    } catch (error) {
      console.error("Copy path failed:", error);
    }
  };

  return {
    searchQuery,
    getIndexStatus,
    createIndex,
    previewFile,
    openFile,
    openFolder,
    copyPath,
  };
}
