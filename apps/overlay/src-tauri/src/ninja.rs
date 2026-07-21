/// Proxy fetch for the poe.ninja API. Lives on the Rust side purely to avoid
/// CORS — the frontend builds the URL and parses the JSON.
#[tauri::command]
pub async fn fetch_ninja(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    let res = client
        .get(&url)
        .header("User-Agent", "exiled-orb/0.1.0")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("API error: {}", res.status()));
    }

    res.text().await.map_err(|e| format!("Read error: {}", e))
}
