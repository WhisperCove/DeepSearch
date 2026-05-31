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
                .add_directive("localsearch_pro=info".parse().unwrap()),
        )
        .init();

    tracing::info!("Starting LocalSearch Pro...");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // Initialize database in app data directory with fallback
            let app_dir = match app.path().app_data_dir() {
                Ok(dir) => {
                    tracing::info!("App data directory: {:?}", dir);
                    dir
                }
                Err(e) => {
                    tracing::error!("Failed to get app data dir: {}", e);
                    let fallback = std::env::temp_dir().join("localsearch-pro");
                    tracing::warn!("Falling back to temp directory: {:?}", fallback);
                    fallback
                }
            };

            if let Err(e) = std::fs::create_dir_all(&app_dir) {
                tracing::error!("Failed to create app data dir {:?}: {}", app_dir, e);
                // Last resort: use temp dir
                let temp_dir = std::env::temp_dir().join("localsearch-pro");
                if let Err(e2) = std::fs::create_dir_all(&temp_dir) {
                    tracing::error!("Failed to create temp dir {:?}: {}", temp_dir, e2);
                }
            }

            let db_path = app_dir.join("localsearch.db");
            tracing::info!("Database path: {:?}", db_path);

            let db = match Database::open(&db_path) {
                Ok(db) => {
                    tracing::info!("Database opened successfully at {:?}", db_path);
                    db
                }
                Err(e) => {
                    tracing::error!("Failed to open database at {:?}: {}", db_path, e);
                    // Try temp directory as fallback
                    let temp_db = std::env::temp_dir()
                        .join("localsearch-pro")
                        .join("localsearch.db");
                    tracing::warn!("Trying fallback database at {:?}", temp_db);
                    Database::open(&temp_db).unwrap_or_else(|e2| {
                        panic!(
                            "Failed to open database even in temp dir {:?}: {}",
                            temp_db, e2
                        )
                    })
                }
            };

            let db = Arc::new(db);
            app.manage(db.clone());

            // Auto-index on startup (background thread)
            let db_clone = db.clone();
            std::thread::spawn(move || {
                // Give UI time to load before heavy indexing
                std::thread::sleep(std::time::Duration::from_secs(2));

                let dirs = core::index_manager::get_all_scan_dirs();
                if dirs.is_empty() {
                    tracing::warn!("[AUTO-INDEX] No directories to scan!");
                    tracing::info!(
                        "[AUTO-INDEX] USERPROFILE: {:?}",
                        std::env::var("USERPROFILE")
                    );
                    tracing::info!(
                        "[AUTO-INDEX] Home dir: {:?}",
                        dirs::home_dir()
                    );
                    return;
                }

                tracing::info!(
                    "[AUTO-INDEX] Starting auto-index of {} directories",
                    dirs.len()
                );
                for dir in &dirs {
                    tracing::info!("[AUTO-INDEX] Will scan: {:?}", dir);
                }

                match core::index_manager::index_directory(&db_clone, &dirs) {
                    Ok(progress) => {
                        tracing::info!(
                            "[AUTO-INDEX] Complete: {} indexed, {} skipped, {} total",
                            progress.indexed,
                            progress.skipped,
                            progress.total
                        );
                    }
                    Err(e) => {
                        tracing::error!("[AUTO-INDEX] Failed: {}", e);
                        tracing::error!("[AUTO-INDEX] Backtrace: {:?}", e);
                    }
                }
            });

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
