//! Global overlay-toggle hotkey.
//!
//! Registered via tauri-plugin-global-shortcut so the toggle works while the
//! game (or any other app) has focus — the old in-window keydown listener only
//! fired when the overlay itself was focused. The toggle hides/shows the real
//! Tauri window, so a hidden overlay costs nothing to render.

use tauri::Manager;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Hide the overlay window if visible, show it (without stealing focus) if not.
/// A minimized window reports is_visible() == true but is effectively unseen,
/// so treat it as hidden: unminimize + show instead of hiding it further.
fn toggle_overlay(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("overlay") {
        let minimized = window.is_minimized().unwrap_or(false);
        match window.is_visible() {
            Ok(true) if !minimized => {
                let _ = window.hide();
            }
            _ => {
                let _ = window.unminimize();
                let _ = window.show();
            }
        }
    }
}

/// Refuse shortcuts that would hijack everyday input system-wide.
///
/// `RegisterHotKey` happily grabs Ctrl+C or a bare letter — nothing else
/// "owns" them as hotkeys — so the OS never reports a conflict. But a global
/// Ctrl+C breaks copy in every app (including the in-game item copy this
/// overlay's price check depends on), and a bare letter swallows typing.
fn validate_shortcut(shortcut: &Shortcut) -> Result<(), String> {
    let mods = shortcut.mods;
    let key = format!("{:?}", shortcut.key);
    let typing_key = key.starts_with("Key")
        || key.starts_with("Digit")
        || matches!(
            shortcut.key,
            Code::Space | Code::Enter | Code::Tab | Code::Backspace | Code::Delete
        );
    let has_chord_mod = mods.intersects(Modifiers::CONTROL | Modifiers::ALT | Modifiers::SUPER);

    if typing_key && !has_chord_mod {
        return Err("that key would capture normal typing in every app; add Ctrl or Alt, or use a function key".into());
    }
    if mods == Modifiers::CONTROL
        && matches!(
            shortcut.key,
            Code::KeyC | Code::KeyV | Code::KeyX | Code::KeyA | Code::KeyZ | Code::KeyY
        )
    {
        return Err("that shortcut is reserved for copy/paste/undo system-wide (ExiledOrb itself needs Ctrl+C for item copies)".into());
    }
    if mods == Modifiers::ALT && shortcut.key == Code::F4 {
        return Err("Alt+F4 closes windows system-wide".into());
    }
    Ok(())
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
    validate_shortcut(&shortcut).map_err(|why| format!("refusing hotkey '{hotkey}': {why}"))?;

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

#[cfg(test)]
mod tests {
    use super::*;

    fn check(s: &str) -> Result<(), String> {
        validate_shortcut(&s.parse::<Shortcut>().expect("parses"))
    }

    #[test]
    fn accepts_function_keys_and_real_chords() {
        for s in [
            "F5",
            "F12",
            "Ctrl+Shift+O",
            "Alt+X",
            "Ctrl+Alt+C",
            "Ctrl+Shift+C",
            "Ctrl+F5",
        ] {
            assert!(check(s).is_ok(), "{s} should be accepted");
        }
    }

    #[test]
    fn rejects_clipboard_and_undo_chords() {
        for s in ["Ctrl+C", "Ctrl+V", "Ctrl+X", "Ctrl+A", "Ctrl+Z", "Ctrl+Y"] {
            let err = check(s).expect_err(&format!("{s} should be refused"));
            assert!(err.contains("copy/paste"), "{s}: {err}");
        }
    }

    #[test]
    fn rejects_bare_typing_keys() {
        for s in ["C", "Shift+C", "5", "Space", "Enter"] {
            let err = check(s).expect_err(&format!("{s} should be refused"));
            assert!(err.contains("typing"), "{s}: {err}");
        }
    }

    #[test]
    fn rejects_alt_f4() {
        assert!(check("Alt+F4").is_err());
    }
}
