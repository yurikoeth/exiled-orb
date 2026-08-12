//! OAuth2 PKCE flow against pathofexile.com.
//!
//! The flow:
//!   1. Generate `code_verifier` + `code_challenge` (SHA-256, base64-url).
//!   2. Bind a local TCP listener on REDIRECT_PORT.
//!   3. Open the system browser to /oauth/authorize with our PKCE params.
//!   4. User signs in + approves, GGG redirects to localhost/callback.
//!   5. Accept the redirect connection, validate `state`, extract `code`.
//!   6. POST /oauth/token with code + verifier → access + refresh token.
//!   7. Persist tokens to a JSON file in the Tauri app data dir.
//!
//! All API calls that need a token go through `get_access_token()` which
//! transparently refreshes when the access token is near expiry.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine as _;
use rand::Rng;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use tauri_plugin_opener::OpenerExt;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio::time::timeout;

// --- Configuration constants ----------------------------------------------

const CLIENT_ID: &str = "exiledorb";
const REDIRECT_URI: &str = "http://localhost:11343/callback";
const REDIRECT_PORT: u16 = 11343;
const AUTHORIZE_URL: &str = "https://www.pathofexile.com/oauth/authorize";
const TOKEN_URL: &str = "https://www.pathofexile.com/oauth/token";
const SCOPES: &str = "account:characters account:profile";
const CALLBACK_TIMEOUT_SECS: u64 = 300; // 5 minutes
const TOKENS_FILE: &str = "ggg_tokens.json";

// --- Persisted token shape -------------------------------------------------

#[derive(Serialize, Deserialize, Clone)]
pub struct StoredTokens {
    pub access_token: String,
    pub refresh_token: Option<String>,
    /// Unix timestamp (seconds) when the access token expires.
    pub expires_at: u64,
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn tokens_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("app_data_dir: {e}"))?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("mkdir app_data_dir: {e}"))?;
    Ok(dir.join(TOKENS_FILE))
}

fn save_tokens(app: &AppHandle, tokens: &StoredTokens) -> Result<(), String> {
    let path = tokens_path(app)?;
    let json = serde_json::to_string(tokens).map_err(|e| format!("serialize tokens: {e}"))?;
    std::fs::write(&path, json).map_err(|e| format!("write tokens: {e}"))?;
    Ok(())
}

fn load_tokens(app: &AppHandle) -> Option<StoredTokens> {
    let path = tokens_path(app).ok()?;
    let bytes = std::fs::read(&path).ok()?;
    serde_json::from_slice(&bytes).ok()
}

fn delete_tokens(app: &AppHandle) -> Result<(), String> {
    let path = tokens_path(app)?;
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("delete tokens: {e}"))?;
    }
    Ok(())
}

// --- PKCE helpers ----------------------------------------------------------

const VERIFIER_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
const STATE_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

fn generate_code_verifier() -> String {
    let mut rng = rand::thread_rng();
    (0..64)
        .map(|_| VERIFIER_CHARS[rng.gen_range(0..VERIFIER_CHARS.len())] as char)
        .collect()
}

fn code_challenge(verifier: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(hasher.finalize())
}

fn generate_state() -> String {
    let mut rng = rand::thread_rng();
    (0..32)
        .map(|_| STATE_CHARS[rng.gen_range(0..STATE_CHARS.len())] as char)
        .collect()
}

/// Minimal percent-encoding (shared with oauth.rs for path segments).
pub(crate) fn urlencode(s: &str) -> String {
    let mut result = String::with_capacity(s.len() * 2);
    for c in s.chars() {
        match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => result.push(c),
            ' ' => result.push_str("%20"),
            _ => {
                for b in c.to_string().as_bytes() {
                    result.push_str(&format!("%{:02X}", b));
                }
            }
        }
    }
    result
}

fn build_authorize_url(state: &str, challenge: &str) -> String {
    format!(
        "{}?response_type=code&client_id={}&redirect_uri={}&scope={}&state={}&code_challenge={}&code_challenge_method=S256",
        AUTHORIZE_URL,
        CLIENT_ID,
        urlencode(REDIRECT_URI),
        urlencode(SCOPES),
        state,
        challenge,
    )
}

// --- Callback server -------------------------------------------------------

/// Accept exactly one connection on the already-bound listener and parse
/// the OAuth callback. Validates `state` against `expected_state` and
/// returns the `code` parameter (or an error).
async fn accept_callback(listener: TcpListener, expected_state: &str) -> Result<String, String> {
    let (mut stream, _peer) = timeout(
        Duration::from_secs(CALLBACK_TIMEOUT_SECS),
        listener.accept(),
    )
    .await
    .map_err(|_| {
        "Authorization timed out (5 min). Click Connect again and complete the GGG sign-in."
            .to_string()
    })?
    .map_err(|e| format!("Accept failed: {e}"))?;

    // Read the request — we only need the request line for the query string.
    let mut buf = [0u8; 8192];
    let n = stream
        .read(&mut buf)
        .await
        .map_err(|e| format!("Read callback: {e}"))?;
    let req = String::from_utf8_lossy(&buf[..n]);
    let first_line = req.lines().next().unwrap_or("");

    let parts: Vec<&str> = first_line.split_whitespace().collect();
    let path = parts.get(1).copied().unwrap_or("");
    let query = path.split_once('?').map(|(_, q)| q).unwrap_or("");

    let mut code: Option<String> = None;
    let mut state: Option<String> = None;
    let mut err: Option<String> = None;
    for pair in query.split('&') {
        let mut kv = pair.splitn(2, '=');
        let k = kv.next().unwrap_or("");
        let v = kv.next().unwrap_or("");
        match k {
            "code" => code = Some(v.to_string()),
            "state" => state = Some(v.to_string()),
            "error" => err = Some(v.to_string()),
            _ => {}
        }
    }

    // Always send a friendly response — the user is staring at the browser tab.
    let body = if let Some(e) = err.as_deref() {
        format!(
            "<!doctype html><html><body style='font-family:system-ui;padding:2rem'><h2>Authorization failed</h2><p>{}</p><p>You can close this window and try again in ExiledOrb.</p></body></html>",
            e
        )
    } else {
        "<!doctype html><html><body style='font-family:system-ui;padding:2rem'><h2>Authorized!</h2><p>You can close this window and return to ExiledOrb.</p></body></html>".to_string()
    };
    let response = format!(
        "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        body.len(),
        body
    );
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.shutdown().await;

    if let Some(e) = err {
        return Err(format!("GGG returned error: {}", e));
    }
    let code = code.ok_or_else(|| "No 'code' parameter in callback".to_string())?;
    let state = state.ok_or_else(|| "No 'state' parameter in callback".to_string())?;
    if state != expected_state {
        return Err("State mismatch — possible CSRF, aborting.".to_string());
    }
    Ok(code)
}

// --- Token exchange + refresh ----------------------------------------------

#[derive(Deserialize)]
struct TokenResponse {
    access_token: String,
    refresh_token: Option<String>,
    expires_in: u64,
    #[allow(dead_code)]
    token_type: Option<String>,
    #[allow(dead_code)]
    scope: Option<String>,
}

fn tokens_from_response(tr: TokenResponse) -> StoredTokens {
    StoredTokens {
        access_token: tr.access_token,
        refresh_token: tr.refresh_token,
        expires_at: now_secs() + tr.expires_in,
    }
}

async fn exchange_code(code: &str, verifier: &str) -> Result<StoredTokens, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;
    let params = [
        ("grant_type", "authorization_code"),
        ("client_id", CLIENT_ID),
        ("code", code),
        ("redirect_uri", REDIRECT_URI),
        ("code_verifier", verifier),
    ];
    let resp = client
        .post(TOKEN_URL)
        .header(
            "User-Agent",
            concat!("exiled-orb/", env!("CARGO_PKG_VERSION")),
        )
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Token request failed: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Token exchange failed ({}): {}", status, body));
    }
    let tr: TokenResponse = resp.json().await.map_err(|e| format!("Token parse: {e}"))?;
    Ok(tokens_from_response(tr))
}

async fn refresh_tokens(refresh_token: &str) -> Result<StoredTokens, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;
    let params = [
        ("grant_type", "refresh_token"),
        ("client_id", CLIENT_ID),
        ("refresh_token", refresh_token),
    ];
    let resp = client
        .post(TOKEN_URL)
        .header(
            "User-Agent",
            concat!("exiled-orb/", env!("CARGO_PKG_VERSION")),
        )
        .form(&params)
        .send()
        .await
        .map_err(|e| format!("Refresh request failed: {e}"))?;
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!("Token refresh failed ({}): {}", status, body));
    }
    let tr: TokenResponse = resp.json().await.map_err(|e| format!("Token parse: {e}"))?;
    Ok(tokens_from_response(tr))
}

/// Get a valid access token. Refreshes transparently when within 60 seconds
/// of expiry. Returns an explicit error if not authenticated so callers can
/// surface a "Connect with GGG" prompt to the user.
pub async fn get_access_token(app: &AppHandle) -> Result<String, String> {
    let stored = load_tokens(app)
        .ok_or_else(|| "Not connected to GGG — click Connect on the Characters tab.".to_string())?;
    if stored.expires_at > now_secs() + 60 {
        return Ok(stored.access_token);
    }
    let refresh = stored.refresh_token.clone().ok_or_else(|| {
        "Access token expired and no refresh token. Reconnect with GGG.".to_string()
    })?;
    let fresh = refresh_tokens(&refresh).await?;
    save_tokens(app, &fresh)?;
    Ok(fresh.access_token)
}

// --- Tauri commands --------------------------------------------------------

/// Run the full OAuth dance: bind localhost listener, open browser, await
/// callback, exchange code, persist tokens. Returns Ok(()) on success.
#[tauri::command]
pub async fn start_oauth_flow(app: AppHandle) -> Result<(), String> {
    let verifier = generate_code_verifier();
    let challenge = code_challenge(&verifier);
    let state = generate_state();

    // Bind FIRST so the browser-redirect race can't happen.
    let addr = format!("127.0.0.1:{}", REDIRECT_PORT);
    let listener = TcpListener::bind(&addr).await.map_err(|e| {
        format!(
            "Cannot bind {} (port may be in use by another app or a previous OAuth attempt): {}",
            addr, e
        )
    })?;
    eprintln!("[ExiledOrb] OAuth: listener bound on {}", addr);

    // Open browser.
    let url = build_authorize_url(&state, &challenge);
    // `None` = the system default browser rather than a named application.
    app.opener()
        .open_url(url.as_str(), None::<&str>)
        .map_err(|e| format!("Cannot open browser: {e}"))?;
    eprintln!("[ExiledOrb] OAuth: opened authorize URL in browser");

    // Wait for callback.
    let code = accept_callback(listener, &state).await?;
    eprintln!("[ExiledOrb] OAuth: callback received, exchanging code");

    // Exchange code for tokens.
    let tokens = exchange_code(&code, &verifier).await?;
    save_tokens(&app, &tokens)?;
    eprintln!("[ExiledOrb] OAuth: tokens persisted");

    Ok(())
}

#[tauri::command]
pub async fn is_authenticated(app: AppHandle) -> bool {
    // A tokens file alone is not enough: an expired access token with no
    // refresh token cannot be used or refreshed, and reporting it as
    // authenticated strands the user in the "Connected" view with no
    // reconnect button. Treat that state as not authenticated so the UI
    // offers the Connect flow instead.
    load_tokens(&app).is_some_and(|t| t.expires_at > now_secs() + 60 || t.refresh_token.is_some())
}

#[tauri::command]
pub async fn disconnect_oauth(app: AppHandle) -> Result<(), String> {
    delete_tokens(&app)?;
    eprintln!("[ExiledOrb] OAuth: disconnected (tokens deleted)");
    Ok(())
}
