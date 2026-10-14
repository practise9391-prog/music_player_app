// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod audio;
mod commands;
mod database;
mod filesystem;
mod network;

fn main() {
    println!("Nova Music Player - Native Core Initializing");
}
