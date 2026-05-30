use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::db::Database;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewResult {
    #[serde(rename = "type")]
    pub preview_type: String,
    pub content: String,
    pub language: Option<String>,
    pub metadata: FileMetadata,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileMetadata {
    pub id: String,
    pub name: String,
    pub path: String,
    pub ext: String,
    pub size: i64,
    pub modified_at: i64,
}

/// Get file preview content
#[tauri::command(rename_all = "camelCase")]
pub async fn preview_file(
    file_id: String,
    db: tauri::State<'_, Arc<Database>>,
) -> Result<PreviewResult, String> {
    tracing::info!("[PREVIEW] Loading preview for file_id={}", file_id);

    let id: i64 = file_id.parse().map_err(|_| "Invalid file ID")?;

    let conn = db.conn.lock().map_err(|e| e.to_string())?;

    let meta: (String, String, String, i64, i64) = conn
        .query_row(
            "SELECT path, name, ext, size, modified_at FROM files WHERE id = ?1",
            rusqlite::params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        )
        .map_err(|e| format!("File not found (id={}): {}", file_id, e))?;

    let (path, name, ext, size, modified_at) = meta;

    // Drop the lock before reading file content
    drop(conn);

    let preview_type = match ext.as_str() {
        "txt" | "md" | "log" | "ini" | "cfg" | "conf" | "env" | "lnk" | "url" | "csv" => "text",
        "js" | "jsx" | "ts" | "tsx" | "py" | "rs" | "go" | "java" | "cpp" | "c" | "h"
        | "hpp" | "css" | "scss" | "less" | "sh" | "bash" | "ps1" | "bat" | "cmd" | "sql"
        | "r" | "lua" | "vim" | "json" | "xml" | "yaml" | "yml" | "toml" | "html" | "htm" => {
            "code"
        }
        "pdf" => "pdf",
        "docx" | "doc" => "docx",
        "png" | "jpg" | "jpeg" | "gif" | "bmp" | "webp" | "svg" | "ico" | "tiff" | "tif" => {
            "image"
        }
        "xlsx" | "xls" => "table",
        _ => "unsupported",
    };

    let content = match preview_type {
        "text" | "code" => {
            // Read as text
            read_text_content(&path, &ext)
        }
        "pdf" | "docx" | "image" => {
            // Read as binary and convert to base64
            match std::fs::read(&path) {
                Ok(bytes) => base64::encode(&bytes),
                Err(e) => {
                    tracing::error!("[PREVIEW] Failed to read binary file: {}", e);
                    String::new()
                }
            }
        }
        _ => String::new(),
    };

    tracing::info!(
        "[PREVIEW] Loaded: name='{}', type={}, content_len={}",
        name,
        preview_type,
        content.len()
    );

    Ok(PreviewResult {
        preview_type: preview_type.to_string(),
        content,
        language: None,
        metadata: FileMetadata {
            id: file_id,
            name,
            path,
            ext,
            size,
            modified_at,
        },
    })
}

/// Read text file content (first 5000 chars)
fn read_text_content(path: &str, ext: &str) -> String {
    let bytes = match std::fs::read(path) {
        Ok(b) => b,
        Err(e) => return format!("Error reading file: {}", e),
    };

    if bytes.is_empty() {
        return "[Empty file]".to_string();
    }

    // Limit to 5000 bytes for preview
    let preview_bytes = if bytes.len() > 5000 {
        &bytes[..5000]
    } else {
        &bytes
    };

    // Try to decode as text
    match std::str::from_utf8(preview_bytes) {
        Ok(s) => {
            if bytes.len() > 5000 {
                format!("{}\n\n... (showing first 5000 of {} bytes)", s, bytes.len())
            } else {
                s.to_string()
            }
        }
        Err(_) => {
            let s = String::from_utf8_lossy(preview_bytes);
            if bytes.len() > 5000 {
                format!(
                    "{}\n\n... (showing first 5000 of {} bytes, binary content)",
                    s,
                    bytes.len()
                )
            } else {
                format!("{} (binary content)", s)
            }
        }
    }
}
