use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ScannedFile {
    pub path: String,
    pub filename: String,
    pub extension: String,
    pub size_bytes: u64,
}

pub fn is_audio_extension(ext: &str) -> bool {
    matches!(
        ext.to_lowercase().as_str(),
        "mp3" | "flac" | "wav" | "ogg" | "m4a" | "aac" | "opus" | "webm"
    )
}
