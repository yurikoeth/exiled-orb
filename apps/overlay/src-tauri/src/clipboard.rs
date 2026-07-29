use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// Checks if clipboard text looks like a PoE item
fn is_poe_item(text: &str) -> bool {
    text.contains("Item Class:") || (text.contains("Rarity:") && text.contains("--------"))
}

/// Read clipboard text using raw Win32 API (more reliable than arboard)
fn read_clipboard_win32() -> Option<String> {
    use std::ptr;

    unsafe {
        // OpenClipboard with NULL owner — retries on failure
        let mut opened = false;
        for _ in 0..3 {
            if OpenClipboard(ptr::null_mut()) != 0 {
                opened = true;
                break;
            }
            std::thread::sleep(Duration::from_millis(10));
        }
        if !opened {
            return None;
        }

        let handle = GetClipboardData(CF_UNICODETEXT);
        if handle.is_null() {
            CloseClipboard();
            return None;
        }

        let ptr = GlobalLock(handle) as *const u16;
        if ptr.is_null() {
            CloseClipboard();
            return None;
        }

        // Find null terminator
        let mut len = 0;
        while *ptr.add(len) != 0 {
            len += 1;
        }

        let slice = std::slice::from_raw_parts(ptr, len);
        let text = String::from_utf16_lossy(slice);

        GlobalUnlock(handle);
        CloseClipboard();

        Some(text)
    }
}

const CF_UNICODETEXT: u32 = 13;

extern "system" {
    fn OpenClipboard(hwnd: *mut std::ffi::c_void) -> i32;
    fn CloseClipboard() -> i32;
    fn GetClipboardData(format: u32) -> *mut std::ffi::c_void;
    fn GlobalLock(hmem: *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    fn GlobalUnlock(hmem: *mut std::ffi::c_void) -> i32;
}

/// Continuously polls the clipboard for PoE item text.
/// When a new item is detected, emits a "clipboard-item" event to the frontend.
pub fn start_clipboard_watcher(app: AppHandle) {
    let last_content: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));

    std::thread::spawn(move || {
        eprintln!("[ExiledOrb] Clipboard watcher started (Win32 API)");

        loop {
            std::thread::sleep(Duration::from_millis(500));

            let text = match read_clipboard_win32() {
                Some(t) if !t.is_empty() => t,
                _ => continue,
            };

            let mut last = last_content.lock().unwrap();
            if text != *last {
                if is_poe_item(&text) {
                    eprintln!(
                        "[ExiledOrb] Clipboard: detected PoE item ({} chars)",
                        text.len()
                    );
                    *last = text.clone();
                    drop(last);

                    match app.emit("clipboard-item", text) {
                        Ok(_) => eprintln!("[ExiledOrb] Clipboard: event emitted OK"),
                        Err(e) => eprintln!("[ExiledOrb] Clipboard: emit failed: {}", e),
                    }
                } else {
                    *last = text;
                }
            }
        }
    });
}
