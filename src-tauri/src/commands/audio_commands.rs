#[tauri::command]
pub fn check_dolby_support() -> bool {
    crate::audio::check_hardware_spatial_support()
}
