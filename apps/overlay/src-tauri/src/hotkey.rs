//! Global overlay-toggle hotkey.
//!
//! Registered via tauri-plugin-global-shortcut so the toggle works while the
//! game (or any other app) has focus — the old in-window keydown listener only
//! fired when the overlay itself was focused. The toggle hides/shows the real
//! Tauri window, so a hidden overlay costs nothing to render.

use tauri::Manager;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Hide the overlay window if visible, show it (without stealing focus) if not.
fn toggle_overlay(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("overlay") {
        match window.is_visible() {
            Ok(true) => {
                let _ = window.hide();
            }
            _ => {
                let _ = window.show();
            }
        }
    }
}

/// Tauri command: (re-)register the global overlay toggle hotkey.
///
/// Called by the frontend after settings load with the stored
/// `settings.overlay.hotkey` (default "F5"). Any previously registered
/// shortcut is dropped first, so calling this repeatedly is safe.
#[tauri::command]
pub fn set_overlay_hotkey(app: tauri::AppHandle, hotkey: String) -> Result<(), String> {
    let shortcuts = app.global_shortcut();

    let shortcut: Shortcut = hotkey
        .parse()
        .map_err(|e| format!("invalid hotkey '{hotkey}': {e}"))?;

    // Drop any prior registration (settings change / re-mount) before re-adding.
    let _ = shortcuts.unregister_all();

    shortcuts
        .on_shortcut(shortcut, |app, _shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                toggle_overlay(app);
            }
        })
        .map_err(|e| format!("failed to register hotkey '{hotkey}': {e}"))?;

    println!("[ExiledOrb] Global overlay hotkey registered: {hotkey}");
    Ok(())
}
