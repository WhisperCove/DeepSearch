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
        .setup(|app| {
            // Initialize database in app data directory
            let app_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data dir");
            std::fs::create_dir_all(&app_dir).expect("Failed to create app data dir");
            let db_path = app_dir.join("localsearch.db");
            let db = Database::open(&db_path).expect("Failed to open database");
            let db = Arc::new(db);
            app.manage(db.clone());

            // Auto-index on startup (background thread)
            let db_clone = db.clone();
            std::thread::spawn(move || {
                // Small delay to let the UI load first
                std::thread::sleep(std::time::Duration::from_millis(500));

                let dirs = core::index_manager::get_all_scan_dirs();
                if dirs.is_empty() {
                    tracing::warn!("[AUTO-INDEX] No directories to scan");
                    return;
                }

                tracing::info!(
                    "[AUTO-INDEX] Starting auto-index of {} directories",
                    dirs.len()
                );

                match core::index_manager::index_directory(&db_clone, &dirs) {
                    Ok(progress) => {
                        tracing::info!(
                            "[AUTO-INDEX] Complete: {} indexed, {} skipped",
                            progress.indexed,
                            progress.skipped
                        );
                    }
                    Err(e) => {
                        tracing::error!("[AUTO-INDEX] Failed: {}", e);
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
