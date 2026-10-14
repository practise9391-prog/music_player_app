use std::sync::atomic::{AtomicBool, Ordering};

pub struct NetworkAirGapState {
    pub is_locked: AtomicBool,
}

impl Default for NetworkAirGapState {
    fn default() -> Self {
        Self {
            is_locked: AtomicBool::new(true), // Default: BLOCKED
        }
    }
}

impl NetworkAirGapState {
    pub fn is_locked(&self) -> bool {
        self.is_locked.load(Ordering::SeqCst)
    }

    pub fn set_lock(&self, locked: bool) {
        self.is_locked.store(locked, Ordering::SeqCst);
    }
}
