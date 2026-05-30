use rusqlite::params;
use serde::Serialize;
use std::sync::Arc;

use crate::db::Database;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub id: String,
    pub name: String,
    pub path: String,
    pub ext: String,
    pub size: i64,
    pub modified_at: i64,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilters {
    pub ext: Option<Vec<String>>,
}

/// Execute a file search query - returns up to 500 matching results
#[tauri::command]
pub async fn search_query(
    query: String,
    _page: Option<usize>,
    _page_size: Option<usize>,
    _filters: Option<SearchFilters>,
    db: tauri::State<'_, Arc<Database>>,
) -> Result<Vec<SearchResult>, String> {
    tracing::info!("[SEARCH] Called with query='{}'", query);

    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let conn = db.conn.lock().map_err(|e| {
        tracing::error!("[SEARCH] Failed to lock DB: {}", e);
        e.to_string()
    })?;

    let like_pattern = format!("%{}%", query);

    // Get total count for logging
    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM files WHERE name LIKE ?1 OR path LIKE ?1",
            params![like_pattern],
            |row| row.get(0),
        )
        .unwrap_or(0);

    tracing::info!("[SEARCH] Total matching files: {}", total);

    // Get up to 500 results (LIMIT 500)
    let mut stmt = conn
        .prepare(
            "SELECT id, path, name, ext, size, modified_at
             FROM files
             WHERE name LIKE ?1 OR path LIKE ?1
             ORDER BY 
               CASE WHEN name LIKE ?1 THEN 0 ELSE 1 END,
               name
             LIMIT 500",
        )
        .map_err(|e| {
            tracing::error!("[SEARCH] Failed to prepare statement: {}", e);
            e.to_string()
        })?;

    let results: Vec<SearchResult> = stmt
        .query_map(params![like_pattern], |row| {
            Ok(SearchResult {
                id: row.get::<_, i64>(0)?.to_string(),
                path: row.get(1)?,
                name: row.get(2)?,
                ext: row.get(3)?,
                size: row.get(4)?,
                modified_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    tracing::info!("[SEARCH] Returned {} results", results.len());

    Ok(results)
}
