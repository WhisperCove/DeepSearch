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

    tracing::info!("=== DeepSearch Starting ===");
    tracing::info!("OS: {} {}", std::env::consts::OS, std::env::consts::ARCH);

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            tracing::info!("Setup starting...");

            // Get app data directory with fallbacks
            let app_dir = get_app_data_dir(app);
            tracing::info!("Using app dir: {:?}", app_dir);

            // Create directory with retry
            if let Err(e) = std::fs::create_dir_all(&app_dir) {
                tracing::error!("Failed to create {:?}: {}", app_dir, e);
                // Try alternative paths
                let alternatives = [
                    std::env::temp_dir().join("DeepSearch"),
                    dirs::home_dir().unwrap_or_default().join("DeepSearch"),
                    std::path::PathBuf::from("C:\\DeepSearch"),
                ];
                for alt in &alternatives {
                    if std::fs::create_dir_all(alt).is_ok() {
                        tracing::info!("Using alternative: {:?}", alt);
                        break;
                    }
                }
            }

            let db_path = app_dir.join("deepsearch.db");
            tracing::info!("Database: {:?}", db_path);

            // Open database with retry
            let db = open_database(&db_path);

            let db = Arc::new(db);
            app.manage(db.clone());

            // Auto-index with error recovery
            let db_clone = db.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(2));
                auto_index(db_clone);
            });

            tracing::info!("Setup complete");
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
    // Try multiple methods
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
    // Try primary path
    match Database::open(db_path) {
        Ok(db) => return db,
        Err(e) => tracing::error!("DB open failed at {:?}: {}", db_path, e),
    }

    // Fallback paths
    let fallbacks = [
        std::env::temp_dir().join("DeepSearch").join("deepsearch.db"),
        dirs::home_dir().unwrap_or_default().join("DeepSearch").join("deepsearch.db"),
    ];

    for fallback in &fallbacks {
        let _ = std::fs::create_dir_all(fallback.parent().unwrap());
        match Database::open(fallback) {
            Ok(db) => {
                tracing::info!("DB opened at {:?}", fallback);
                return db;
            }
            Err(e) => tracing::error!("DB open failed at {:?}: {}", fallback, e),
        }
    }

    panic!("Cannot open database in any location");
}

fn auto_index(db: Arc<Database>) {
    tracing::info!("Auto-index starting...");

    let dirs = core::index_manager::get_all_scan_dirs();
    tracing::info!("Found {} directories", dirs.len());

    // If no dirs found, try direct USERPROFILE scan
    let dirs = if dirs.is_empty() {
        tracing::warn!("No dirs from get_all_scan_dirs(), trying USERPROFILE fallback");
        let mut fallback = Vec::new();
        if let Ok(up) = std::env::var("USERPROFILE") {
            let home = std::path::PathBuf::from(up);
            for name in &["Desktop", "Documents", "Downloads", "桌面", "文档", "下载"] {
                let path = home.join(name);
                if path.exists() {
                    tracing::info!("Fallback found: {:?}", path);
                    fallback.push(path);
                }
            }
        }
        fallback
    } else {
        dirs
    };

    if dirs.is_empty() {
        tracing::error!("No directories to scan!");
        return;
    }

    match core::index_manager::index_directory(&db, &dirs) {
        Ok(p) => tracing::info!("Indexed: {} files", p.indexed),
        Err(e) => tracing::error!("Index failed: {}", e),
    }
}
