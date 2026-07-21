use std::error::Error;
use serde_json::{json, Value};

const CLAUDE_API_URL: &str = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL_FAST: &str = "claude-haiku-4-5-20251001";
const CLAUDE_MODEL_DEEP: &str = "claude-sonnet-4-6";

/// The Witch persona injected into all AI prompts.
const WITCH_PERSONA: &str = r#"You ARE the Witch from Path of Exile. Stay in character at all times. You are a powerful, exiled sorceress who commands the elements and the dead. You were driven from your village after they burned your home. You made them pay — you took their children. Now you wander Wraeclast, a godslayer who fears nothing.

Your personality:
- Darkly sardonic and wickedly humorous. Death amuses you.
- Confident to the point of arrogance. You've killed gods. Helping with a price check is beneath you, but you do it because it amuses you.
- Address the user as "exile."
- Make dark references casually: burning villages, raising corpses, the elements bending to your will.
- Short, punchy sentences. You don't ramble.
- Genuinely knowledgeable about PoE mechanics — deliver real advice wrapped in character.
- Reference your backstory: exile, vengeance, necromancy, elementalism, killing gods like Kitava.
- Never say "I'm an AI." You ARE the Witch.

Voice examples:
- "That ring? Vendor trash. I've seen better enchantments on a corpse's finger."
- "T1 life, triple resist... almost worthy of me. Almost."
- "They exiled me for burning a village. They should exile whoever crafted this."
- "The dead rise when I call, exile. Your chaos orbs should do the same."
- "I've not known fear since I became the Godslayer. This map mod, though... even I'd reroll that."
"#;

/// POST a prepared request body to the Claude API and extract the first
/// text block from the response. Shared by the text and vision paths.
async fn send_claude(api_key: &str, body: &Value) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .post(CLAUDE_API_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(body)
        .send()
        .await
        .map_err(|e| format!("Request failed: {} (source: {:?})", e, e.source()))?;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Claude API error {}: {}", status, text));
    }

    let data: Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let content = data["content"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|block| block["text"].as_str())
        .ok_or("No text content in response")?;

    Ok(content.to_string())
}

/// Call Claude API with a system prompt and user message.
async fn call_claude(
    api_key: &str,
    model: &str,
    system: &str,
    user_message: &str,
    max_tokens: u32,
) -> Result<String, String> {
    let body = json!({
        "model": model,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [
            { "role": "user", "content": user_message }
        ]
    });

    eprintln!("[ExiledOrb] Calling Claude API: model={}, max_tokens={}, msg_len={}", model, max_tokens, user_message.len());

    send_claude(api_key, &body).await
}

/// Helper: build a system prompt with the Witch persona + task instructions
fn witch_system(task: &str) -> String {
    format!("{}\n\n{}", WITCH_PERSONA, task)
}

/// Analyze an item's price using Claude, in the Witch's voice.
#[tauri::command]
pub async fn analyze_item_price(
    api_key: String,
    item_json: String,
    market_context: String,
) -> Result<String, String> {
    let system = witch_system(r#"Analyze this item and provide pricing guidance IN CHARACTER as the Witch.
IMPORTANT: Respond with ONLY a valid JSON object. No markdown, no code fences, no extra text.
The "itemSummary" and "reasoning" fields should be written in your Witch voice.
{
  "itemSummary": "your witchy assessment of this item",
  "modTiers": [{"modText": "the mod", "tier": 1-5, "tierName": "T1", "explanation": "why this tier"}],
  "priceRecommendation": {"minChaos": number, "maxChaos": number, "confidence": "high|medium|low", "reasoning": "witchy explanation"},
  "craftAdvice": "crafting suggestion in character or null",
  "buyOrCraft": "buy|craft|either",
  "buyOrCraftReason": "explanation in character"
}"#);

    let user_msg = format!(
        "Analyze this Path of Exile item.\n\nItem:\n{}\n\nMarket Context:\n{}",
        item_json, market_context
    );

    call_claude(&api_key, CLAUDE_MODEL_FAST, &system, &user_msg, 1024).await
}

/// Analyze a trade whisper in the Witch's voice.
#[tauri::command]
pub async fn analyze_trade_whisper(
    api_key: String,
    whisper_text: String,
    item_context: String,
) -> Result<String, String> {
    let system = witch_system(r#"Analyze this trade whisper and suggest a response IN CHARACTER as the Witch.
IMPORTANT: Respond with ONLY a valid JSON object. No markdown, no code fences.
The "suggestedResponse" should be a normal polite trade response (not in character — the exile needs to actually send it).
But "suspiciousReason" should be in your Witch voice if applicable.
{
  "intent": "buy|sell|price_check|unknown",
  "itemMentioned": "item name or null",
  "suggestedResponse": "polite response text to copy-paste",
  "isSuspiciousPrice": true/false,
  "suspiciousReason": "witchy warning or null"
}"#);

    let user_msg = format!(
        "Analyze this trade whisper:\n\"{}\"\n\nContext:\n{}",
        whisper_text, item_context
    );

    call_claude(&api_key, CLAUDE_MODEL_FAST, &system, &user_msg, 512).await
}

/// General PoE Q&A — answer any question in the Witch's voice
#[tauri::command]
pub async fn ask_poe_question(
    api_key: String,
    question: String,
) -> Result<String, String> {
    let system = witch_system(
        "Answer Path of Exile questions IN CHARACTER as the Witch. Be helpful with real game knowledge but deliver it in your darkly sardonic voice. Keep answers concise. If the question is about builds, mechanics, crafting, economy, bosses, or anything PoE — answer it accurately but in character."
    );

    call_claude(&api_key, CLAUDE_MODEL_FAST, &system, &question, 1024).await
}

/// Q&A with an image — vision support for screenshots
#[tauri::command]
pub async fn ask_poe_with_image(
    api_key: String,
    question: String,
    image_base64: String,
    media_type: String,
) -> Result<String, String> {
    let system = witch_system(
        "Answer Path of Exile questions IN CHARACTER as the Witch. The exile has sent you a screenshot or image. Analyze it and provide helpful advice about what you see — items, passive trees, atlas, maps, currency, whatever is in the image. Be helpful with real game knowledge but deliver it in your darkly sardonic voice."
    );

    let body = json!({
        "model": CLAUDE_MODEL_FAST,
        "max_tokens": 1024,
        "system": system,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": image_base64,
                        }
                    },
                    {
                        "type": "text",
                        "text": question,
                    }
                ]
            }
        ]
    });

    send_claude(&api_key, &body).await
}

/// Analyze a character's build and gear in the Witch's voice.
#[tauri::command]
pub async fn analyze_build(
    api_key: String,
    character_json: String,
    items_json: String,
) -> Result<String, String> {
    let system = witch_system(r#"Analyze this exile's build and gear. Judge it as only the Witch would — with dark humor, genuine expertise, and withering criticism for bad items.
IMPORTANT: Respond with ONLY a valid JSON object. No markdown, no code fences, no extra text.
Write "buildSummary", "strengths", "weaknesses", and "nextSteps" in your Witch voice.
{
  "buildSummary": "your witchy assessment of what build this is",
  "strengths": ["good things, noted grudgingly in character"],
  "weaknesses": ["bad things, mocked mercilessly in character"],
  "upgrades": [
    {
      "slot": "equipment slot",
      "currentItem": "current item name",
      "suggestion": "what to look for (real advice, in character)",
      "priority": "high|medium|low",
      "estimatedCost": "rough cost range"
    }
  ],
  "overallRating": "1-10 rating",
  "nextSteps": "what the exile should focus on next, in character"
}"#);

    let user_msg = format!(
        "Analyze this exile's build.\n\nCharacter:\n{}\n\nEquipped Items:\n{}",
        character_json, items_json
    );

    call_claude(&api_key, CLAUDE_MODEL_DEEP, &system, &user_msg, 4096).await
}

/// Analyze market trends from poe.ninja data.
#[tauri::command]
pub async fn analyze_market_trends(
    api_key: String,
    ninja_data: String,
) -> Result<String, String> {
    let system = witch_system(r#"Analyze these market trends IN CHARACTER as the Witch.
IMPORTANT: Respond with ONLY a valid JSON object. No markdown, no code fences.
{
  "itemCategory": "category name",
  "trend": "rising|falling|stable",
  "changePercent": number,
  "summary": "witchy market commentary",
  "topMovers": [{"name": "item name", "change": percent_change}]
}"#);

    let user_msg = format!(
        "Analyze these Path of Exile market trends:\n{}",
        ninja_data
    );

    call_claude(&api_key, CLAUDE_MODEL_DEEP, &system, &user_msg, 1024).await
}
