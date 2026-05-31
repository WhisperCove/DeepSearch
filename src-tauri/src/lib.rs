mod commands;
mod core;
mod db;

use std::sync::Arc;
use tauri::Manager;
use tracing_subscriber::{fmt, EnvFilter};

use db::Database;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logging
    fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("deepsearch=info".parse().unwrap()),
        )
        .init();

    tracing::info!("===========================================");
    tracing::info!("DeepSearch Starting");
    tracing::info!("OS: {}", std::env::consts::OS);
    tracing::info!("Arch: {}", std::env::consts::ARCH);
    tracing::info!("===========================================");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            tracing::info!("[SETUP] Starting application setup...");

            // Get app data directory
            let app_dir = get_app_data_dir(app);
            tracing::info!("[SETUP] App directory: {:?}", app_dir);

            // Create directory
            match std::fs::create_dir_all(&app_dir) {
                Ok(_) => tracing::info!("[SETUP] Directory created/exists"),
                Err(e) => tracing::error!("[SETUP] Failed to create directory: {}", e),
            }

            let db_path = app_dir.join("deepsearch.db");
            tracing::info!("[SETUP] Database path: {:?}", db_path);

            // Open database
            let db = open_database(&db_path);

            let db = Arc::new(db);
            app.manage(db.clone());

            // Auto-index
            let db_clone = db.clone();
            std::thread::spawn(move || {
                tracing::info!("[INDEX] Index thread started, waiting 2s...");
                std::thread::sleep(std::time::Duration::from_secs(2));
                auto_index(db_clone);
            });

            tracing::info!("[SETUP] Setup complete");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::search::search_query,
            commands::index::index_create,
            commands::index::index_rebuild,
            commands::index::index_status,
            commands::preview::preview_file,
            commands::config::open_file,
            commands::config::open_folder,
            commands::config::copy_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn get_app_data_dir(app: &tauri::App) -> std::path::PathBuf {
    if let Ok(dir) = app.path().app_data_dir() {
        return dir;
    }
    if let Ok(appdata) = std::env::var("APPDATA") {
        return std::path::PathBuf::from(appdata).join("DeepSearch");
    }
    if let Ok(localappdata) = std::env::var("LOCALAPPDATA") {
        return std::path::PathBuf::from(localappdata).join("DeepSearch");
    }
    std::env::temp_dir().join("DeepSearch")
}

fn open_database(db_path: &std::path::Path) -> Database {
    tracing::info!("[DB] Attempting to open database at {:?}", db_path);
    match Database::open(db_path) {
        Ok(db) => {
            tracing::info!("[DB] Database opened successfully at {:?}", db_path);
            return db;
        }
        Err(e) => tracing::error!("[DB] Failed at {:?}: {}", db_path, e),
    }

    // Fallback paths
    let fallbacks = [
        std::env::temp_dir().join("DeepSearch").join("deepsearch.db"),
        dirs::home_dir().unwrap_or_default().join("DeepSearch").join("deepsearch.db"),
    ];

    for fallback in &fallbacks {
        tracing::info!("[DB] Trying fallback: {:?}", fallback);
        let _ = std::fs::create_dir_all(fallback.parent().unwrap());
        match Database::open(fallback) {
            Ok(db) => {
                tracing::info!("[DB] Database opened at fallback {:?}", fallback);
                return db;
            }
            Err(e) => tracing::error!("[DB] Fallback failed at {:?}: {}", fallback, e),
        }
    }

    panic!("Cannot open database in any location");
}

fn auto_index(db: Arc<Database>) {
    tracing::info!("[INDEX] =============================");
    tracing::info!("[INDEX] Auto-index starting...");
    tracing::info!("[INDEX] =============================");

    let dirs = core::index_manager::get_all_scan_dirs();
    tracing::info!("[INDEX] Found {} directories from config", dirs.len());

    for dir in &dirs {
        tracing::info!("[INDEX]   - {:?}", dir);
    }

    // If no dirs found, try direct USERPROFILE scan
    let dirs = if dirs.is_empty() {
        tracing::warn!("[INDEX] No dirs from config, trying USERPROFILE fallback...");
        let mut fallback = Vec::new();
        if let Ok(up) = std::env::var("USERPROFILE") {
            let home = std::path::PathBuf::from(up);
            tracing::info!("[INDEX] USERPROFILE: {:?}", home);
            for name in &["Desktop", "Documents", "Downloads", "桌面", "文档", "下载"] {
                let path = home.join(name);
                if path.exists() {
                    tracing::info!("[INDEX] Fallback found: {:?}", path);
                    fallback.push(path);
                } else {
                    tracing::info!("[INDEX] Fallback not found: {:?}", path);
                }
            }
        } else {
            tracing::error!("[INDEX] USERPROFILE env var not set!");
        }
        fallback
    } else {
        dirs
    };

    if dirs.is_empty() {
        tracing::error!("[INDEX] No directories to scan!");
        return;
    }

    tracing::info!("[INDEX] Scanning {} directories...", dirs.len());
    match core::index_manager::index_directory(&db, &dirs) {
        Ok(p) => {
            tracing::info!("[INDEX] =============================");
            tracing::info!("[INDEX] Indexing Complete!");
            tracing::info!("[INDEX] Total: {}", p.total);
            tracing::info!("[INDEX] Indexed: {}", p.indexed);
            tracing::info!("[INDEX] Skipped: {}", p.skipped);
            tracing::info!("[INDEX] =============================");
        }
        Err(e) => tracing::error!("[INDEX] Indexing failed: {}", e),
    }
}
