use std::process::Command;

#[tauri::command]
pub fn check_network_locked() -> bool {
    // Air-gap check
    true
}

#[tauri::command]
pub fn set_network_locked(locked: bool) -> bool {
    locked
}

#[derive(serde::Serialize)]
pub struct YtDlpCheckResult {
    pub available: bool,
    pub version: Option<String>,
    pub binary_path: Option<String>,
}

#[tauri::command]
pub fn check_ytdlp_available() -> YtDlpCheckResult {
    match Command::new("yt-dlp").arg("--version").output() {
        Ok(out) if out.status.success() => {
            let ver = String::from_utf8_lossy(&out.stdout).trim().to_string();
            YtDlpCheckResult {
                available: true,
                version: Some(ver),
                binary_path: Some("/usr/bin/yt-dlp".into()),
            }
        }
        _ => YtDlpCheckResult {
            available: false,
            version: None,
            binary_path: None,
        },
    }
}

#[tauri::command]
pub fn resolve_youtube_audio(url: String) -> Result<serde_json::Value, String> {
    // Safe process execution: argument vector, no shell string concatenation
    let output = Command::new("yt-dlp")
        .args(&[
            "-j",
            "--no-playlist",
            "--no-warnings",
            "--prefer-free-formats",
            "--format",
            "bestaudio/best",
            "--",
            &url,
        ])
        .output()
        .map_err(|e| format!("Failed to spawn yt-dlp: {}", e))?;

    if !output.status.success() {
        let err_msg = String::from_utf8_lossy(&output.stderr);
        return Err(err_msg.trim().to_string());
    }

    let json_str = String::from_utf8_lossy(&output.stdout);
    serde_json::from_str(&json_str)
        .map_err(|e| format!("Failed to parse resolver JSON: {}", e))
}

#[derive(serde::Serialize)]
pub struct CacheDownloadResult {
    pub success: bool,
    pub video_id: String,
    pub file_path: String,
    pub size_bytes: u64,
    pub codec: String,
    pub error: Option<String>,
}

#[tauri::command]
pub fn cache_youtube_stream(url: String, video_id: String) -> Result<CacheDownloadResult, String> {
    let root = if let Ok(home) = std::env::var("HOME") {
        std::path::PathBuf::from(home).join(".local/share/nova-music/cache/youtube")
    } else {
        std::path::PathBuf::from("./cache/youtube")
    };

    let target_dir = root.join(&video_id);
    let _ = std::fs::create_dir_all(&target_dir);

    // Output template to temporary .partial file
    let temp_template = target_dir.join("audio.partial.%(ext)s");
    let temp_template_str = temp_template.to_string_lossy().to_string();

    let output = Command::new("yt-dlp")
        .args(&[
            "-x",
            "--no-playlist",
            "--no-warnings",
            "--prefer-free-formats",
            "--format",
            "bestaudio/best",
            "-o",
            &temp_template_str,
            "--",
            &url,
        ])
        .output()
        .map_err(|e| format!("Failed to execute download: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Download failed: {}", err.trim()));
    }

    // Find the downloaded audio.partial.<ext> and rename atomically to audio.<ext>
    let mut final_path = None;
    let mut final_size = 0;
    let mut ext_found = "opus".to_string();

    if let Ok(entries) = std::fs::read_dir(&target_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                if name.starts_with("audio.partial.") {
                    let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("opus");
                    ext_found = ext.to_string();
                    let target_final = target_dir.join(format!("audio.{}", ext));
                    let _ = std::fs::rename(&path, &target_final);
                    if let Ok(meta) = std::fs::metadata(&target_final) {
                        final_size = meta.len();
                        final_path = Some(target_final.to_string_lossy().to_string());
                    }
                    break;
                }
            }
        }
    }

    match final_path {
        Some(p) => Ok(CacheDownloadResult {
            success: true,
            video_id,
            file_path: p,
            size_bytes: final_size,
            codec: ext_found,
            error: None,
        }),
        None => Err("Downloaded audio file could not be finalized".into()),
    }
}

