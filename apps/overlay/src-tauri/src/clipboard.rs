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
    fn GetClipboardSequenceNumber() -> u32;
}

/// Continuously polls the clipboard for PoE item text.
/// When a new item is detected, emits a "clipboard-item" event to the frontend.
///
/// Change detection uses the Windows clipboard SEQUENCE NUMBER, not the text
/// content: every copy bumps the sequence, so Ctrl+C-ing the SAME item again
/// (check price → dismiss → re-copy to re-check) re-emits. Content comparison
/// silently swallowed that — the panel never reappeared. The sequence also
/// means whatever is already on the clipboard at app launch is NOT emitted;
/// only copies made while the app is running trigger.
pub fn start_clipboard_watcher(app: AppHandle) {
    std::thread::spawn(move || {
        eprintln!("[ExiledOrb] Clipboard watcher started (Win32 API, sequence-number)");

        // GetClipboardSequenceNumber needs no open clipboard and never blocks.
        let mut last_seq = unsafe { GetClipboardSequenceNumber() };

        loop {
            std::thread::sleep(Duration::from_millis(500));

            let seq = unsafe { GetClipboardSequenceNumber() };
            if seq == last_seq {
                continue;
            }
            last_seq = seq;

            let text = match read_clipboard_win32() {
                Some(t) if !t.is_empty() => t,
                _ => continue,
            };

            if is_poe_item(&text) {
                eprintln!(
                    "[ExiledOrb] Clipboard: detected PoE item ({} chars, seq {})",
                    text.len(),
                    seq
                );
                match app.emit("clipboard-item", text) {
                    Ok(_) => eprintln!("[ExiledOrb] Clipboard: event emitted OK"),
                    Err(e) => eprintln!("[ExiledOrb] Clipboard: emit failed: {}", e),
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::is_poe_item;

    #[test]
    fn item_class_header_is_an_item() {
        assert!(is_poe_item("Item Class: Rings\nRarity: Rare\nDoom Loop"));
    }

    #[test]
    fn rarity_needs_the_section_separator() {
        assert!(is_poe_item(
            "Rarity: Unique\nHeadhunter\n--------\nLeather Belt"
        ));
        assert!(!is_poe_item("Rarity: Unique\nHeadhunter"));
    }

    #[test]
    fn ordinary_text_is_not_an_item() {
        assert!(!is_poe_item(""));
        assert!(!is_poe_item("https://poe.ninja"));
        assert!(!is_poe_item("the rarity of this drop is amazing --------"));
    }
}
