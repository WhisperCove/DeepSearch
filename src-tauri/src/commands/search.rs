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

/// Execute a file search query
#[tauri::command(rename_all = "camelCase")]
pub async fn search_query(
    query: String,
    page: Option<usize>,
    page_size: Option<usize>,
    filters: Option<SearchFilters>,
    db: tauri::State<'_, Arc<Database>>,
) -> Result<Vec<SearchResult>, String> {
    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(50);
    let offset = ((page - 1) * page_size) as i64;

    if query.trim().is_empty() {
        tracing::info!("[SEARCH] Empty query, returning empty results");
        return Ok(vec![]);
    }

    tracing::info!(
        "[SEARCH] query='{}', page={}, size={}",
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
        return Ok(vec![]);
    }

    let like_pattern = format!("%{}%", query);

    // LIKE search on name and path
    let mut stmt = conn
        .prepare(
            "SELECT id, path, name, ext, size, modified_at
             FROM files
             WHERE name LIKE ?1 OR path LIKE ?1
             ORDER BY name
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

    tracing::info!("[SEARCH] Found {} results", results.len());

    Ok(results)
}
