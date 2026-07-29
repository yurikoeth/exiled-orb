use std::sync::LazyLock;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

/// Hosts the proxy may talk to — the frontend builds the URL, so restrict it
/// server-side rather than trusting the caller.
const ALLOWED_HOSTS: [&str; 2] = ["poe.ninja", "poe2.ninja"];

/// Minimum spacing between upstream requests. poe.ninja has no documented
/// rate-limit protocol; the frontend already caches responses for 5 minutes
/// (ninja-cache.ts), this is belt-and-braces for cache-miss bursts.
const MIN_INTERVAL: Duration = Duration::from_millis(300);

static LAST_REQUEST: LazyLock<Mutex<Option<Instant>>> = LazyLock::new(|| Mutex::new(None));

/// Wait until at least MIN_INTERVAL has passed since the previous request,
/// reserving the next slot while the lock is held (never sleeps under it).
async fn space_requests() {
    let wait = {
        let mut last = LAST_REQUEST.lock().await;
        let now = Instant::now();
        let wait = match *last {
            Some(prev) => (prev + MIN_INTERVAL).saturating_duration_since(now),
            None => Duration::ZERO,
        };
        *last = Some(now + wait);
        wait
    };
    if !wait.is_zero() {
        tokio::time::sleep(wait).await;
    }
}

/// Proxy fetch for the poe.ninja API. Lives on the Rust side purely to avoid
/// CORS — the frontend builds the URL and parses the JSON.
#[tauri::command]
pub async fn fetch_ninja(url: String) -> Result<String, String> {
    let parsed = reqwest::Url::parse(&url).map_err(|e| format!("Invalid URL: {}", e))?;
    let host = parsed.host_str().unwrap_or_default();
    if parsed.scheme() != "https" || !ALLOWED_HOSTS.contains(&host) {
        return Err(format!("Refusing to proxy non-poe.ninja URL: {}", url));
    }

    space_requests().await;

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    let res = client
        .get(parsed)
        .header("User-Agent", "exiled-orb/0.1.0")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("API error: {}", res.status()));
    }

    res.text().await.map_err(|e| format!("Read error: {}", e))
}
