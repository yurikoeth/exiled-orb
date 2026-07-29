mod ai;
mod clipboard;
mod log_watcher;
mod ninja;
mod oauth;
mod oauth_flow;
mod rate_limit;
mod settings;

use std::path::PathBuf;
use tauri::Manager;
use tauri::tray::TrayIconBuilder;
use tauri::menu::{MenuBuilder, MenuItemBuilder};

/// Tauri command: set the Client.txt log path and start watching it
#[tauri::command]
fn set_log_path(app: tauri::AppHandle, path: String) {
    let log_path = PathBuf::from(path);
    if log_path.exists() {
        log_watcher::start_log_watcher(app, log_path);
    } else {
        eprintln!("Log file does not exist: {:?}", log_path);
    }
}

/// Tauri command: get default log file paths to check
#[tauri::command]
fn get_default_log_paths() -> Vec<String> {
    log_watcher::log_path_candidates()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::new()
                .add_migrations(settings::DB_URL, settings::migrations())
                .build(),
        )
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(log_watcher::GameState(std::sync::Mutex::new(
            log_watcher::InitialGameState::default(),
        )))
        .invoke_handler(tauri::generate_handler![
            set_log_path,
            get_default_log_paths,
            log_watcher::get_initial_game_state,
            log_watcher::scan_character_history,
            ai::ask_poe_question,
            ai::ask_poe_with_image,
            ai::analyze_item_price,
            ai::analyze_trade_whisper,
            ai::analyze_market_trends,
            ai::analyze_build,
            ninja::fetch_ninja,
            oauth::fetch_characters,
            oauth::fetch_character_items,
            oauth_flow::start_oauth_flow,
            oauth_flow::is_authenticated,
            oauth_flow::disconnect_oauth,
        ])
        .setup(|app| {
            // Build system tray
            let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app).items(&[&show, &quit]).build()?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().expect("app icon must be set in tauri.conf.json").clone())
                .tooltip("ExiledOrb")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("overlay") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // Start clipboard watcher on launch
            let handle = app.handle().clone();
            clipboard::start_clipboard_watcher(handle);

            // Auto-detect Client.txt: pick the most-recently-modified existing log
            // so the active game wins when both PoE1 and PoE2 are installed.
            let handle = app.handle().clone();
            let paths = get_default_log_paths();
            let mut candidates: Vec<(PathBuf, std::time::SystemTime)> = paths
                .iter()
                .map(PathBuf::from)
                .filter_map(|p| {
                    let modified = std::fs::metadata(&p).ok()?.modified().ok()?;
                    Some((p, modified))
                })
                .collect();
            candidates.sort_by(|a, b| b.1.cmp(&a.1));
            if let Some((path, _)) = candidates.into_iter().next() {
                println!("Auto-detected log file (most recent): {:?}", path);
                log_watcher::start_log_watcher(handle, path);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
