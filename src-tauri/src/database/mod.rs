// Native SQLite database support module for desktop runtime
pub struct NativeDbState {
    pub is_ready: bool,
}

impl Default for NativeDbState {
    fn default() -> Self {
        Self { is_ready: true }
    }
}
