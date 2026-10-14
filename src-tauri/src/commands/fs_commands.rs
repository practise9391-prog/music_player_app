use std::fs;
use std::path::{Path, PathBuf};

#[tauri::command]
pub async fn pick_music_folder() -> Result<Option<String>, String> {
    // In Tauri desktop, native dialog picker is triggered here
    Ok(None)
}

fn get_app_cache_root() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join(".local/share/nova-music/cache/youtube")
    } else if let Ok(app_data) = std::env::var("APPDATA") {
        PathBuf::from(app_data).join("nova-music/cache/youtube")
    } else {
        PathBuf::from("./cache/youtube")
    }
}

#[derive(serde::Serialize)]
pub struct NativeCacheMetadata {
    pub exists: boolean_compat,
    pub path: String,
    pub size_bytes: u64,
    pub is_valid: bool,
}

type boolean_compat = bool;

#[tauri::command]
pub fn get_cache_directory() -> Result<String, String> {
    let dir = get_app_cache_root();
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn verify_native_cache(video_id: String) -> NativeCacheMetadata {
    let root = get_app_cache_root();
    let video_dir = root.join(&video_id);

    if !video_dir.exists() {
        return NativeCacheMetadata {
            exists: false,
            path: "".into(),
            size_bytes: 0,
            is_valid: false,
        };
    }

    // Look for audio.* file
    if let Ok(entries) = fs::read_dir(&video_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if let Some(name) = p.file_name().and_then(|n| n.to_str()) {
                if name.starts_with("audio.") && !name.ends_with(".partial") {
                    if let Ok(meta) = fs::metadata(&p) {
                        let size = meta.len();
                        return NativeCacheMetadata {
                            exists: true,
                            path: p.to_string_lossy().to_string(),
                            size_bytes: size,
                            is_valid: size > 4096, // Must be > 4KB valid audio
                        };
                    }
                }
            }
        }
    }

    NativeCacheMetadata {
        exists: false,
        path: "".into(),
        size_bytes: 0,
        is_valid: false,
    }
}

#[tauri::command]
pub fn delete_native_cache(video_id: String) -> Result<bool, String> {
    let root = get_app_cache_root();
    let video_dir = root.join(&video_id);
    if video_dir.exists() {
        fs::remove_dir_all(&video_dir).map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub fn clear_all_native_cache() -> Result<u64, String> {
    let root = get_app_cache_root();
    if !root.exists() {
        return Ok(0);
    }
    let mut freed_bytes = 0;
    if let Ok(entries) = fs::read_dir(&root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                if let Ok(meta) = fs::metadata(&path) {
                    freed_bytes += meta.len();
                }
                let _ = fs::remove_dir_all(&path);
            }
        }
    }
    Ok(freed_bytes)
}
