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
    // Text files
    "txt", "md", "markdown", "log", "csv", "json", "xml", "yaml", "yml", "toml",
    // Code files
    "js", "jsx", "ts", "tsx", "py", "rs", "go", "java", "cpp", "c", "h", "hpp",
    "css", "html", "htm", "scss", "less", "sh", "bash", "ps1", "bat", "cmd",
    "sql", "r", "lua", "vim", "ini", "cfg", "conf", "env",
    // Document files
    "pdf", "docx", "doc", "xlsx", "xls", "pptx", "ppt", "rtf", "odt", "ods", "odp",
    // Image files
    "png", "jpg", "jpeg", "gif", "bmp", "webp", "svg", "ico", "tiff", "tif",
    // Video files
    "mp4", "avi", "mov", "mkv", "wmv", "flv", "webm", "m4v", "3gp", "mpg", "mpeg",
    // Windows shortcuts
    "lnk", "url",
    // Other
    "exe", "dll", "sys", "tmp",
];

/// Index progress tracking
#[derive(Debug, Default, serde::Serialize)]
pub struct IndexProgress {
    pub total: u64,
    pub indexed: u64,
    pub skipped: u64,
}

/// Get directories to scan (user directories only for fast initial scan)
pub fn get_all_scan_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();

    tracing::info!("[INDEX] Starting directory discovery...");

    // Method 1: dirs::home_dir()
    let home = match dirs::home_dir() {
        Some(h) => {
            tracing::info!("[INDEX] home_dir(): {:?}", h);
            Some(h)
        }
        None => {
            tracing::warn!("[INDEX] home_dir() returned None");
            None
        }
    };

    // Method 2: USERPROFILE env var
    let userprofile = match std::env::var("USERPROFILE") {
        Ok(up) => {
            tracing::info!("[INDEX] USERPROFILE: {}", up);
            Some(std::path::PathBuf::from(up))
        }
        Err(e) => {
            tracing::warn!("[INDEX] USERPROFILE not found: {}", e);
            None
        }
    };

    // Use whichever is available
    let base_dir = home.or(userprofile);

    if let Some(base) = base_dir {
        let user_dirs = [
            ("Desktop", "桌面"),
            ("Documents", "文档"),
            ("Downloads", "下载"),
            ("Pictures", "图片"),
            ("Music", "音乐"),
            ("Videos", "视频"),
        ];

        for (en_name, cn_name) in &user_dirs {
            let candidate = base.join(en_name);
            if candidate.exists() && candidate.is_dir() {
                tracing::info!("[INDEX] Found: {:?}", candidate);
                dirs.push(candidate);
            } else {
                let candidate_cn = base.join(cn_name);
                if candidate_cn.exists() && candidate_cn.is_dir() {
                    tracing::info!("[INDEX] Found (CN): {:?}", candidate_cn);
                    dirs.push(candidate_cn);
                }
            }
        }

        // Check OneDrive
        let onedrive = base.join("OneDrive");
        if onedrive.exists() && onedrive.is_dir() {
            tracing::info!("[INDEX] Found OneDrive: {:?}", onedrive);
            for (en_name, cn_name) in &[("Desktop", "桌面"), ("Documents", "文档"), ("Downloads", "下载")] {
                let candidate = onedrive.join(en_name);
                if candidate.exists() && candidate.is_dir() && !dirs.contains(&candidate) {
                    dirs.push(candidate);
                } else {
                    let candidate_cn = onedrive.join(cn_name);
                    if candidate_cn.exists() && candidate_cn.is_dir() && !dirs.contains(&candidate_cn) {
                        dirs.push(candidate_cn);
                    }
                }
            }
        }
    }

    // Method 3: Windows registry
    #[cfg(target_os = "windows")]
    {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;

        match RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(
            "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Shell Folders",
            winreg::enums::KEY_READ,
        ) {
            Ok(key) => {
                if let Ok(desktop) = key.get_value::<String, _>("Desktop") {
                    let path = std::path::PathBuf::from(&desktop);
                    if path.exists() && !dirs.contains(&path) {
                        tracing::info!("[INDEX] Registry Desktop: {:?}", path);
                        dirs.push(path);
                    }
                }
                if let Ok(docs) = key.get_value::<String, _>("Personal") {
                    let path = std::path::PathBuf::from(&docs);
                    if path.exists() && !dirs.contains(&path) {
                        tracing::info!("[INDEX] Registry Documents: {:?}", path);
                        dirs.push(path);
                    }
                }
            }
            Err(e) => tracing::warn!("[INDEX] Registry access failed: {}", e),
        }
    }

    dirs.sort();
    dirs.dedup();

    tracing::info!("[INDEX] Total directories found: {}", dirs.len());
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

    tracing::info!("[INDEX] Scanning: {:?}", dir);

    let walker = walkdir::WalkDir::new(dir)
        .follow_links(false)
        .max_depth(5) // Limit depth to avoid permission issues on Win11 Pro
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            // Skip hidden dirs, system dirs, and common large dirs
            !name.starts_with('.')
                && !name.starts_with('$')
                && !SKIP_DIRS.iter().any(|skip| name.eq_ignore_ascii_case(skip))
        });

    let mut count = 0;
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
                            count += 1;
                        }
                        None => {
                            // No extension - index it (README, Makefile, etc.)
                            files.push(path.to_path_buf());
                            count += 1;
                        }
                        _ => {} // Skip non-indexable extensions
                    }
                }
            }
            Err(e) => {
                // Log permission errors at warn level (not debug) for Win11 Pro diagnostics
                tracing::warn!("[INDEX] Error accessing: {}", e);
            }
        }
    }

    tracing::info!("[INDEX] Found {} files in {:?}", count, dir);
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
