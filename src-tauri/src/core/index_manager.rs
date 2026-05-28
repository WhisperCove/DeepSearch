use anyhow::Result;
use rusqlite::params;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::db::Database;

/// System directories to skip during scanning
const SKIP_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "target",
    "Windows",
    "Program Files",
    "Program Files (x86)",
    "ProgramData",
    "$Recycle.Bin",
    "System Volume Information",
    ".svn",
    ".hg",
    "AppData",
    ".cache",
    ".npm",
    ".cargo",
    ".rustup",
    "__pycache__",
];

/// File extensions to index
const INDEXABLE_EXTS: &[&str] = &[
    "txt", "md", "log", "csv", "json", "xml", "yaml", "yml", "toml",
    "js", "jsx", "ts", "tsx", "py", "rs", "go", "java", "cpp", "c", "h", "hpp",
    "css", "html", "htm", "scss", "less", "sh", "bash", "ps1", "bat", "cmd",
    "sql", "r", "lua", "ini", "cfg", "conf", "env",
    "pdf", "docx", "doc", "xlsx", "xls", "pptx", "ppt",
    "lnk", "url", "exe", "dll",
];

/// Index progress tracking
#[derive(Debug, Default, serde::Serialize)]
pub struct IndexProgress {
    pub total: u64,
    pub indexed: u64,
    pub skipped: u64,
}

/// Get all directories to scan (home dir + all drives)
pub fn get_all_scan_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    // Add common user directories
    if let Some(home) = dirs::home_dir() {
        let user_dirs = ["Desktop", "Documents", "Downloads", "Pictures", "Music", "Videos"];
        for dir_name in &user_dirs {
            let candidate = home.join(dir_name);
            if candidate.exists() {
                dirs.push(candidate);
            }
        }
    }

    // Scan all available drives
    for letter in b'C'..=b'Z' {
        let drive = format!("{}:\\", letter as char);
        let drive_path = PathBuf::from(&drive);
        if drive_path.exists() {
            dirs.push(drive_path);
        }
    }

    dirs.sort();
    dirs.dedup();

    tracing::info!("[INDEX] Scan directories ({} total):", dirs.len());
    for d in &dirs {
        tracing::info!("[INDEX]   - {:?}", d);
    }

    dirs
}

/// Scan and index files in the given directories
pub fn index_directory(db: &Arc<Database>, paths: &[PathBuf]) -> Result<IndexProgress> {
    let mut progress = IndexProgress::default();
    let now = SystemTime::now().duration_since(UNIX_EPOCH)?.as_secs() as i64;

    tracing::info!(
        "[INDEX] Starting indexing for {} paths",
        paths.len()
    );

    // Phase 1: Collect all files (no lock held)
    let mut all_files = Vec::new();
    for root in paths {
        if !root.exists() {
            tracing::warn!("[INDEX] Path does not exist: {:?}", root);
            continue;
        }
        tracing::info!("[INDEX] Scanning: {:?}", root);
        collect_files(root, &mut all_files);
        tracing::info!(
            "[INDEX] After {:?}, total files: {}",
            root,
            all_files.len()
        );
    }
    progress.total = all_files.len() as u64;
    tracing::info!("[INDEX] Found {} files total", progress.total);

    // Phase 2: Insert into database in batches of 100
    for (batch_idx, chunk) in all_files.chunks(100).enumerate() {
        let conn = db
            .conn
            .lock()
            .map_err(|e| anyhow::anyhow!("Lock error: {}", e))?;
        
        // Begin transaction for batch
        conn.execute_batch("BEGIN TRANSACTION;")?;
        
        for path in chunk {
            match insert_file(&conn, path, now) {
                Ok(true) => {
                    progress.indexed += 1;
                    if progress.indexed % 500 == 0 {
                        tracing::info!("[INDEX] Progress: {} files indexed", progress.indexed);
                    }
                }
                Ok(false) => progress.skipped += 1,
                Err(e) => {
                    tracing::debug!("[INDEX] Error on {:?}: {}", path, e);
                    progress.skipped += 1;
                }
            }
        }
        
        conn.execute_batch("COMMIT;")?;
        
        if (batch_idx + 1) % 10 == 0 {
            tracing::info!(
                "[INDEX] Batch {} done, indexed={}",
                batch_idx + 1,
                progress.indexed
            );
        }
    }

    tracing::info!(
        "[INDEX] Complete: {} indexed, {} skipped",
        progress.indexed,
        progress.skipped
    );

    Ok(progress)
}

/// Collect all files under a directory
fn collect_files(dir: &Path, files: &mut Vec<PathBuf>) {
    if !dir.is_dir() {
        if dir.is_file() {
            files.push(dir.to_path_buf());
        }
        return;
    }

    let walker = walkdir::WalkDir::new(dir)
        .follow_links(false)
        .max_depth(15)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !SKIP_DIRS.iter().any(|skip| name.eq_ignore_ascii_case(skip))
        });

    for entry in walker {
        match entry {
            Ok(e) => {
                if e.file_type().is_file() {
                    let path = e.path();
                    // Index if extension is in INDEXABLE_EXTS OR if no extension (README, Makefile, etc.)
                    let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase());
                    match ext {
                        Some(ref e) if INDEXABLE_EXTS.contains(&e.as_str()) => {
                            files.push(path.to_path_buf());
                        }
                        None => {
                            // No extension - index it (README, Makefile, etc.)
                            files.push(path.to_path_buf());
                        }
                        _ => {} // Skip non-indexable extensions
                    }
                }
            }
            Err(e) => {
                tracing::debug!("[INDEX] Walk error: {}", e);
            }
        }
    }
}

/// Insert a single file into the database using INSERT OR IGNORE
fn insert_file(
    conn: &rusqlite::Connection,
    path: &Path,
    _now: i64,
) -> Result<bool> {
    let path_str = path.to_string_lossy().to_string();
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    let ext = path
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let metadata = std::fs::metadata(path)?;
    let size = metadata.len() as i64;
    let modified_at = metadata
        .modified()
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    let rows_changed = conn.execute(
        "INSERT OR IGNORE INTO files (path, name, ext, size, modified_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![path_str, name, ext, size, modified_at],
    )?;

    Ok(rows_changed > 0)
}
