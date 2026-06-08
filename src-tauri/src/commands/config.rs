/// Open file with default application
#[tauri::command(rename_all = "camelCase")]
pub async fn open_file(path: String) -> Result<(), String> {
    tracing::info!("[CONFIG] Opening file: {}", path);
    open::that(&path).map_err(|e| format!("Failed to open file: {}", e))
}

/// Open file's parent directory in explorer
#[tauri::command(rename_all = "camelCase")]
pub async fn open_folder(path: String) -> Result<(), String> {
    tracing::info!("[CONFIG] Opening folder for: {}", path);
    let parent = std::path::Path::new(&path)
        .parent()
        .ok_or_else(|| "Cannot get parent directory".to_string())?;
    open::that(parent).map_err(|e| format!("Failed to open folder: {}", e))
}

/// Copy file path to clipboard (no surrounding quotes)
#[tauri::command(rename_all = "camelCase")]
pub async fn copy_path(path: String) -> Result<(), String> {
    tracing::info!("[CONFIG] Copying path to clipboard: {}", path);
    #[cfg(target_os = "windows")]
    {
        // Use clipboard-win to avoid command line window flash
        clipboard_win::set_clipboard_string(&path)
            .map_err(|e| format!("Failed to copy path to clipboard: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        Command::new("pbcopy")
            .arg(&path)
            .output()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "linux")]
    {
        use std::process::Command;
        Command::new("xclip")
            .args(["-selection", "clipboard", &path])
            .output()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
