use serde::Serialize;
use std::path::PathBuf;
use std::sync::Arc;

use crate::core::index_manager;
use crate::db::Database;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndexStatus {
    pub total_files: u64,
    pub is_indexing: bool,
    pub last_updated: i64,
}

/// Create index for given paths
#[tauri::command(rename_all = "camelCase")]
pub async fn index_create(
    paths: Vec<String>,
    db: tauri::State<'_, Arc<Database>>,
) -> Result<IndexStatus, String> {
    tracing::info!("[INDEX_CMD] index_create: paths={:?}", paths);

    let path_bufs: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();

    let db_clone = Arc::clone(&db);
    let progress = tauri::async_runtime::spawn_blocking(move || {
        index_manager::index_directory(&db_clone, &path_bufs)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Index error: {}", e))?;

    tracing::info!(
        "[INDEX_CMD] Complete: {} indexed, {} skipped",
        progress.indexed,
        progress.skipped
    );

    get_index_status(&db)
}

/// Rebuild entire index (clear and re-scan all drives)
#[tauri::command(rename_all = "camelCase")]
pub async fn index_rebuild(
    db: tauri::State<'_, Arc<Database>>,
) -> Result<IndexStatus, String> {
    tracing::info!("[INDEX_CMD] Rebuilding entire index...");

    // Clear all data
    {
        let conn = db.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM files", [])
            .map_err(|e| e.to_string())?;
        tracing::info!("[INDEX_CMD] Cleared all files from database");
    }

    // Re-index all directories
    let dirs = index_manager::get_all_scan_dirs();
    let db_clone = Arc::clone(&db);
    let _progress = tauri::async_runtime::spawn_blocking(move || {
        index_manager::index_directory(&db_clone, &dirs)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
    .map_err(|e| format!("Index error: {}", e))?;

    get_index_status(&db)
}

/// Get current index status
#[tauri::command(rename_all = "camelCase")]
pub async fn index_status(
    db: tauri::State<'_, Arc<Database>>,
) -> Result<IndexStatus, String> {
    get_index_status(&db)
}

fn get_index_status(db: &Arc<Database>) -> Result<IndexStatus, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let total_files: u64 = conn
        .query_row("SELECT COUNT(*) FROM files", [], |row| row.get(0))
        .unwrap_or(0);

    let last_updated: i64 = conn
        .query_row("SELECT MAX(modified_at) FROM files", [], |row| row.get(0))
        .unwrap_or(0);

    Ok(IndexStatus {
        total_files,
        is_indexing: false,
        last_updated,
    })
}
