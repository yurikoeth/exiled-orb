use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::oauth_flow;

const CHAR_API_BASE: &str = "https://api.pathofexile.com/character";

/// GGG Character data
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GggCharacter {
    pub name: String,
    pub class: String,
    pub level: u32,
    pub league: Option<String>,
    pub experience: Option<u64>,
    pub game: String,
}

/// Fetch a single realm's characters via the documented OAuth endpoint.
/// Path is `/character` for PoE1 (default) and `/character/poe2` for PoE2.
/// Response shape: `{ "characters": [...] }` (per developer docs).
async fn fetch_realm(client: &reqwest::Client, token: &str, realm: Option<&str>) -> Vec<GggCharacter> {
    let url = match realm {
        Some(r) => format!("{}/{}", CHAR_API_BASE, r),
        None => CHAR_API_BASE.to_string(),
    };

    let game_tag = match realm {
        Some("poe2") => "poe2",
        _ => "poe1",
    };

    let res = match client
        .get(&url)
        .bearer_auth(token)
        .header("User-Agent", "exiled-orb/0.1.0")
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[ExiledOrb] fetch_realm {:?} network error: {}", realm, e);
            return vec![];
        }
    };

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        eprintln!("[ExiledOrb] fetch_realm {:?} HTTP {}: {}", realm, status, body);
        return vec![];
    }

    let data: serde_json::Value = match res.json().await {
        Ok(d) => d,
        Err(e) => {
            eprintln!("[ExiledOrb] fetch_realm {:?} parse error: {}", realm, e);
            return vec![];
        }
    };

    // Documented shape is { "characters": [...] }; fall back to a top-level
    // array just in case GGG returns something different in practice.
    let chars = data
        .get("characters")
        .and_then(|v| v.as_array())
        .cloned()
        .or_else(|| data.as_array().cloned())
        .unwrap_or_default();

    chars
        .iter()
        .filter_map(|c| {
            Some(GggCharacter {
                name: c["name"].as_str()?.to_string(),
                class: c["class"].as_str()?.to_string(),
                level: c["level"].as_u64()? as u32,
                league: c["league"].as_str().map(|s| s.to_string()),
                experience: c["experience"].as_u64(),
                game: game_tag.to_string(),
            })
        })
        .collect()
}

/// Fetch characters from both PoE1 and PoE2 via the OAuth-authenticated
/// `api.pathofexile.com/character` endpoint. Account is identified by the
/// stored access token — no `accountName` param needed.
#[tauri::command]
pub async fn fetch_characters(app: AppHandle) -> Result<Vec<GggCharacter>, String> {
    let token = oauth_flow::get_access_token(&app).await?;
    let client = reqwest::Client::new();

    let (poe1, poe2) = tokio::join!(
        fetch_realm(&client, &token, None),
        fetch_realm(&client, &token, Some("poe2")),
    );

    let mut all = poe1;
    all.extend(poe2);

    if all.is_empty() {
        return Err(
            "No characters returned from GGG. The OAuth call succeeded but the response was empty — make sure you have characters on this account."
                .to_string(),
        );
    }

    // Dedupe by name — keep the higher-level entry
    let mut seen = std::collections::HashMap::new();
    for char in &all {
        let entry = seen.entry(char.name.clone()).or_insert(char.clone());
        if char.level > entry.level {
            *entry = char.clone();
        }
    }
    let mut deduped: Vec<GggCharacter> = seen.into_values().collect();
    deduped.sort_by(|a, b| b.level.cmp(&a.level));
    Ok(deduped)
}

/// A single socket with color and link group
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SocketInfo {
    pub color: String,
    pub group: u32,
}

/// A single equipped item
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GggItem {
    pub name: String,
    pub base_type: String,
    pub inventory_id: String,
    pub icon: String,
    pub rarity: String,
    pub socket_count: Option<u32>,
    pub max_links: Option<u32>,
    pub socket_details: Vec<SocketInfo>,
    pub ilvl: Option<u32>,
    pub corrupted: bool,
    pub mods: Vec<String>,
}

/// Fetch equipped items for a character via the documented OAuth endpoint
/// `GET api.pathofexile.com/character[/<realm>]/<name>`. The response includes
/// equipment, inventory (PoE1), rucksack (PoE1), and skills (PoE2) — we only
/// surface `equipment` for now to match the existing build-analysis flow.
#[tauri::command]
pub async fn fetch_character_items(
    app: AppHandle,
    character: String,
    game: String,
) -> Result<Vec<GggItem>, String> {
    let token = oauth_flow::get_access_token(&app).await?;
    let client = reqwest::Client::new();

    let encoded_name = oauth_flow::urlencode(&character);
    let url = if game == "poe2" {
        format!("{}/poe2/{}", CHAR_API_BASE, encoded_name)
    } else {
        format!("{}/{}", CHAR_API_BASE, encoded_name)
    };

    let res = client
        .get(&url)
        .bearer_auth(&token)
        .header("User-Agent", "exiled-orb/0.1.0")
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let body = res.text().await.unwrap_or_default();
        return Err(format!("API error ({}): {}", status, body));
    }

    let data: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("Parse error: {}", e))?;

    // Documented shape: { "character": { ..., "equipment": [...], ... } }.
    // Fall back to top-level `equipment` just in case.
    let equipment = data
        .get("character")
        .and_then(|c| c.get("equipment"))
        .or_else(|| data.get("equipment"))
        .and_then(|e| e.as_array())
        .cloned()
        .unwrap_or_default();

    let items = equipment
        .iter()
        .filter_map(|item| {
            let inventory_id = item["inventoryId"].as_str()?.to_string();

            // Sockets — same shape as legacy character-window
            let mut socket_details: Vec<SocketInfo> = Vec::new();
            let (socket_count, max_links) = if let Some(sockets) = item["sockets"].as_array() {
                let count = sockets.len() as u32;
                let mut groups: std::collections::HashMap<u64, u32> = std::collections::HashMap::new();
                for s in sockets {
                    let group = s["group"].as_u64().unwrap_or(0) as u32;
                    *groups.entry(group as u64).or_insert(0) += 1;
                    let attr = s["attr"].as_str().unwrap_or("G");
                    let color = match attr {
                        "S" => "R",
                        "D" => "G",
                        "I" => "B",
                        "G" => "W",
                        "A" => "A",
                        "DV" => "W",
                        _ => "W",
                    };
                    socket_details.push(SocketInfo {
                        color: color.to_string(),
                        group,
                    });
                }
                let max = groups.values().max().copied().unwrap_or(0);
                (Some(count), Some(max))
            } else {
                (None, None)
            };

            let rarity = match item["frameType"].as_u64().unwrap_or(0) {
                0 => "Normal",
                1 => "Magic",
                2 => "Rare",
                3 => "Unique",
                4 => "Gem",
                5 => "Currency",
                _ => "Normal",
            };

            let mods: Vec<String> = item["explicitMods"]
                .as_array()
                .map(|arr| arr.iter().filter_map(|m| m.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();

            Some(GggItem {
                name: item["name"].as_str().unwrap_or("").to_string(),
                base_type: item["typeLine"].as_str()?.to_string(),
                inventory_id,
                icon: item["icon"].as_str().unwrap_or("").to_string(),
                rarity: rarity.to_string(),
                socket_count,
                max_links,
                socket_details,
                ilvl: item["ilvl"].as_u64().map(|v| v as u32),
                corrupted: item["corrupted"].as_bool().unwrap_or(false),
                mods,
            })
        })
        .collect();

    Ok(items)
}

