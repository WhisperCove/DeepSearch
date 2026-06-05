mod commands;
mod core;
mod db;

use std::sync::Arc;
use tauri::{Emitter, Manager};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri_plugin_global_shortcut::GlobalShortcutExt;
use tracing_subscriber::{fmt, EnvFilter};

use db::Database;

// Keep tray alive
struct AppState {
    _tray: TrayIcon,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("deepsearch=info".parse().unwrap()),
        )
        .init();

    tracing::info!("DeepSearch Starting");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            // Tray menu
            let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            // Tray icon - store in state to keep alive
            let tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("DeepSearch - Shift+Enter 唤起")
                .on_menu_event(|app, event| {
                    match event.id.as_ref() {
                        "show" => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.unminimize();
                                let _ = w.show();
                                let _ = w.set_focus();
                                let _ = app.emit("window-shown", ());
                            }
                        }
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    let app = tray.app_handle();
                    match event {
                        tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } => {
                            if let Some(w) = app.get_webview_window("main") {
                                let _ = w.unminimize();
                                let _ = w.show();
                                let _ = w.set_focus();
                                let _ = app.emit("window-shown", ());
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Store tray in managed state to prevent drop
            app.manage(AppState { _tray: tray });

            // Global shortcut: Shift+Enter
            app.global_shortcut().on_shortcut(
                tauri_plugin_global_shortcut::Shortcut::new(
                    Some(tauri_plugin_global_shortcut::Modifiers::SHIFT),
                    tauri_plugin_global_shortcut::Code::Enter,
                ),
                move |app, _shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        tracing::info!("[HOTKEY] Shift+Enter pressed, showing window");
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.unminimize();
                            let _ = w.show();
                            let _ = w.set_focus();
                            let _ = app.emit("window-shown", ());
                        }
                    }
                },
            )?;

            // Database
            let app_dir = get_app_data_dir(app);
            let _ = std::fs::create_dir_all(&app_dir);
            let db_path = app_dir.join("deepsearch.db");
            let db = Arc::new(open_database(&db_path));
            app.manage(db.clone());

            // Auto-index
            let db2 = db.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(1));
                let dirs = core::index_manager::get_all_scan_dirs();
                let dirs = if dirs.is_empty() {
                    get_userprofile_fallback()
                } else {
                    dirs
                };
                if !dirs.is_empty() {
                    let _ = core::index_manager::index_directory(&db2, &dirs);
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

fn get_app_data_dir(app: &tauri::App) -> std::path::PathBuf {
    app.path().app_data_dir().unwrap_or_else(|_| {
        std::env::var("APPDATA")
            .map(|p| std::path::PathBuf::from(p).join("DeepSearch"))
            .unwrap_or_else(|_| std::env::temp_dir().join("DeepSearch"))
    })
}

fn open_database(db_path: &std::path::Path) -> Database {
    Database::open(db_path).unwrap_or_else(|_| {
        let temp = std::env::temp_dir().join("DeepSearch").join("deepsearch.db");
        let _ = std::fs::create_dir_all(temp.parent().unwrap());
        Database::open(&temp).expect("Cannot open database")
    })
}

fn get_userprofile_fallback() -> Vec<std::path::PathBuf> {
    let mut dirs = Vec::new();
    if let Ok(up) = std::env::var("USERPROFILE") {
        let home = std::path::PathBuf::from(up);
        for name in &["Desktop", "Documents", "Downloads", "桌面", "文档", "下载"] {
            let path = home.join(name);
            if path.exists() { dirs.push(path); }
        }
    }
    dirs
}
