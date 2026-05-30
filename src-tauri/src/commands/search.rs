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

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultResponse {
    pub results: Vec<SearchResult>,
    pub total: usize,
    pub has_more: bool,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchFilters {
    pub ext: Option<Vec<String>>,
}

/// Execute a file search query with pagination support
#[tauri::command(rename_all = "camelCase")]
pub async fn search_query(
    query: String,
    page: Option<usize>,
    page_size: Option<usize>,
    filters: Option<SearchFilters>,
    db: tauri::State<'_, Arc<Database>>,
) -> Result<SearchResultResponse, String> {
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(50); // First load: 50 results for fast initial display
    let offset = ((page - 1) * page_size) as i64;

    if query.trim().is_empty() {
        tracing::info!("[SEARCH] Empty query, returning empty results");
        return Ok(SearchResultResponse {
            results: vec![],
            total: 0,
            has_more: false,
        });
    }

    tracing::info!(
        "[SEARCH] query='{}', page={}, page_size={}",
        query,
        page,
        page_size
    );

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    // Quick check: how many files in DB?
    let total_in_db: i64 = conn
        .query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))
        .unwrap_or(0);

    if total_in_db == 0 {
        tracing::warn!("[SEARCH] Database is empty - no files indexed yet");
        return Ok(SearchResultResponse {
            results: vec![],
            total: 0,
            has_more: false,
        });
    }

    let like_pattern = format!("%{}%", query);

    // Get total count of matching results
    let total: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM files WHERE name LIKE ?1 OR path LIKE ?1",
            params![like_pattern],
            |row| row.get(0),
        )
        .unwrap_or(0);

    tracing::info!("[SEARCH] Total matching files: {}", total);

    // LIKE search on name and path, prioritize name matches
    let mut stmt = conn
        .prepare(
            "SELECT id, path, name, ext, size, modified_at
             FROM files
             WHERE name LIKE ?1 OR path LIKE ?1
             ORDER BY
               CASE WHEN name LIKE ?1 THEN 0 ELSE 1 END,
               name
             LIMIT ?2 OFFSET ?3",
        )
        .map_err(|e| e.to_string())?;

    let mut results: Vec<SearchResult> = stmt
        .query_map(
            params![like_pattern, page_size as i64, offset],
            |row| {
                Ok(SearchResult {
                    id: row.get::<_, i64>(0)?.to_string(),
                    path: row.get(1)?,
                    name: row.get(2)?,
                    ext: row.get(3)?,
                    size: row.get(4)?,
                    modified_at: row.get(5)?,
                })
            },
        )
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Apply extension filter in memory
    if let Some(ref f) = filters {
        if let Some(ref exts) = f.ext {
            if !exts.is_empty() {
                results.retain(|r| exts.contains(&r.ext));
            }
        }
    }

    let has_more = (offset + results.len() as i64) < total;

    tracing::info!(
        "[SEARCH] Returned {} results (page {}), total={}, has_more={}",
        results.len(),
        page,
        total,
        has_more
    );

    Ok(SearchResultResponse {
        results,
        total: total as usize,
        has_more,
    })
}
