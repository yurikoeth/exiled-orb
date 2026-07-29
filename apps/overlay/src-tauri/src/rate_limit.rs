//! Client-side rate limiting for the GGG API (api.pathofexile.com).
//!
//! GGG documents its limits via response headers:
//!   X-Rate-Limit-Rules:            comma-separated policy names, e.g. "Account,Ip"
//!   X-Rate-Limit-<Name>:           comma-separated tuples "max:window_s:penalty_s"
//!   X-Rate-Limit-<Name>-State:     matching tuples "current:window_s:restricted_s"
//!   Retry-After:                   seconds, sent with HTTP 429
//!
//! Strategy: keep a process-wide sliding window of our own request times and
//! never exceed the most recently advertised limits. If a response reports an
//! active restriction (State restricted_s > 0) or a 429 arrives, back off for
//! the advertised duration and retry once. All GGG calls should go through
//! [`send`].

use std::collections::VecDeque;
use std::sync::LazyLock;
use std::time::{Duration, Instant};
use tokio::sync::Mutex;

/// One advertised limit tuple: at most `max` requests per `window_s` seconds,
/// with a `penalty_s` lockout for violations.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Rule {
    pub max: u32,
    pub window_s: u32,
    pub penalty_s: u32,
}

/// Parse a comma-separated list of "a:b:c" tuples (limit and state headers
/// share this shape). Malformed tuples are skipped rather than failing the
/// whole header.
fn parse_tuples(header: &str) -> Vec<Rule> {
    header
        .split(',')
        .filter_map(|t| {
            let mut parts = t.trim().split(':');
            Some(Rule {
                max: parts.next()?.trim().parse().ok()?,
                window_s: parts.next()?.trim().parse().ok()?,
                penalty_s: parts.next()?.trim().parse().ok()?,
            })
        })
        .collect()
}

/// Seconds to wait before the next request is allowed under `rules`, given the
/// ages (in seconds) of our previous requests. Pure so it can be unit tested.
fn compute_wait_s(rules: &[Rule], request_ages_s: &[f64]) -> f64 {
    let mut wait: f64 = 0.0;
    for rule in rules {
        if rule.max == 0 {
            continue;
        }
        let window = rule.window_s as f64;
        // Ages of requests still inside this window, oldest first.
        let mut in_window: Vec<f64> = request_ages_s
            .iter()
            .copied()
            .filter(|a| *a < window)
            .collect();
        in_window.sort_by(|a, b| b.partial_cmp(a).unwrap_or(std::cmp::Ordering::Equal));
        let count = in_window.len() as u32;
        if count >= rule.max {
            // Enough old requests must fall out of the window that one slot
            // frees up: the (count - max + 1)-th oldest is the gating one.
            let gating_age = in_window[(count - rule.max) as usize];
            wait = wait.max(window - gating_age);
        }
    }
    wait
}

struct Limiter {
    rules: Vec<Rule>,
    history: VecDeque<Instant>,
    restricted_until: Option<Instant>,
}

impl Limiter {
    /// Drop history entries older than the largest advertised window.
    fn prune(&mut self, now: Instant) {
        let max_window = self.rules.iter().map(|r| r.window_s).max().unwrap_or(0) as u64;
        while let Some(front) = self.history.front() {
            if now.duration_since(*front).as_secs() > max_window {
                self.history.pop_front();
            } else {
                break;
            }
        }
    }
}

/// Conservative default until the first response tells us the real limits.
fn default_rules() -> Vec<Rule> {
    vec![Rule {
        max: 8,
        window_s: 10,
        penalty_s: 60,
    }]
}

static LIMITER: LazyLock<Mutex<Limiter>> = LazyLock::new(|| {
    Mutex::new(Limiter {
        rules: default_rules(),
        history: VecDeque::new(),
        restricted_until: None,
    })
});

/// Hard cap on how long a caller may be parked waiting for a slot — beyond
/// this we fail fast instead of hanging the UI.
const MAX_TOTAL_WAIT: Duration = Duration::from_secs(60);

/// Wait until a request slot is free, then reserve it. The mutex is never held
/// across an await: lock → compute (and reserve if free) → unlock → sleep.
async fn acquire() -> Result<(), String> {
    let deadline = Instant::now() + MAX_TOTAL_WAIT;
    loop {
        let wait = {
            let mut l = LIMITER.lock().await;
            let now = Instant::now();
            let mut wait = l
                .restricted_until
                .map(|t| t.saturating_duration_since(now).as_secs_f64())
                .unwrap_or(0.0);
            l.prune(now);
            let ages: Vec<f64> = l
                .history
                .iter()
                .map(|t| now.duration_since(*t).as_secs_f64())
                .collect();
            wait = wait.max(compute_wait_s(&l.rules, &ages));
            if wait <= 0.0 {
                // Reserve the slot while still holding the lock so concurrent
                // callers can't all pass the check at once.
                l.history.push_back(now);
            }
            wait
        };
        if wait <= 0.0 {
            return Ok(());
        }
        if Instant::now() + Duration::from_secs_f64(wait) > deadline {
            return Err("GGG API rate limit reached — try again in a minute.".to_string());
        }
        tokio::time::sleep(Duration::from_secs_f64(wait.min(5.0) + 0.05)).await;
    }
}

/// Record the rate-limit headers of a GGG response.
async fn record_headers(headers: &reqwest::header::HeaderMap) {
    let rule_names: Vec<String> = headers
        .get("X-Rate-Limit-Rules")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.split(',').map(|n| n.trim().to_string()).collect())
        .unwrap_or_default();
    if rule_names.is_empty() {
        return;
    }

    let mut rules: Vec<Rule> = Vec::new();
    let mut restricted_s: u64 = 0;
    for name in &rule_names {
        if let Some(v) = headers
            .get(format!("X-Rate-Limit-{name}"))
            .and_then(|v| v.to_str().ok())
        {
            rules.extend(parse_tuples(v));
        }
        if let Some(v) = headers
            .get(format!("X-Rate-Limit-{name}-State"))
            .and_then(|v| v.to_str().ok())
        {
            // State tuples are "current:window_s:restricted_s" — a non-zero
            // third field means we are actively restricted.
            for state in parse_tuples(v) {
                restricted_s = restricted_s.max(state.penalty_s as u64);
            }
        }
    }

    let mut l = LIMITER.lock().await;
    if !rules.is_empty() {
        l.rules = rules;
    }
    if restricted_s > 0 {
        l.restricted_until = Some(Instant::now() + Duration::from_secs(restricted_s.min(600)));
    }
}

async fn set_restricted(seconds: u64) {
    let mut l = LIMITER.lock().await;
    l.restricted_until = Some(Instant::now() + Duration::from_secs(seconds.min(600)));
}

/// Send a GGG API request through the rate limiter: wait for a slot, send,
/// learn the advertised limits from the response, and on 429 honor
/// `Retry-After` with a single retry.
pub async fn send(builder: reqwest::RequestBuilder) -> Result<reqwest::Response, String> {
    let retry_builder = builder.try_clone();
    acquire().await?;
    let resp = builder
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?;
    record_headers(resp.headers()).await;

    if resp.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
        let retry_after = resp
            .headers()
            .get("Retry-After")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.trim().parse::<u64>().ok())
            .unwrap_or(5)
            .min(60);
        set_restricted(retry_after).await;
        if let Some(rb) = retry_builder {
            eprintln!("[ExiledOrb] GGG 429 — backing off {retry_after}s and retrying once");
            tokio::time::sleep(Duration::from_secs(retry_after)).await;
            acquire().await?;
            let resp2 = rb
                .send()
                .await
                .map_err(|e| format!("Request failed: {e}"))?;
            record_headers(resp2.headers()).await;
            return Ok(resp2);
        }
    }
    Ok(resp)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_single_tuple() {
        assert_eq!(
            parse_tuples("15:60:120"),
            vec![Rule {
                max: 15,
                window_s: 60,
                penalty_s: 120
            }]
        );
    }

    #[test]
    fn parses_multi_policy_header() {
        assert_eq!(
            parse_tuples("45:60:120, 240:240:900"),
            vec![
                Rule {
                    max: 45,
                    window_s: 60,
                    penalty_s: 120
                },
                Rule {
                    max: 240,
                    window_s: 240,
                    penalty_s: 900
                },
            ]
        );
    }

    #[test]
    fn skips_malformed_tuples() {
        assert_eq!(
            parse_tuples("bogus,10:20:30,1:2"),
            vec![Rule {
                max: 10,
                window_s: 20,
                penalty_s: 30
            }]
        );
        assert!(parse_tuples("").is_empty());
    }

    #[test]
    fn no_wait_under_limit() {
        let rules = vec![Rule {
            max: 3,
            window_s: 10,
            penalty_s: 60,
        }];
        assert_eq!(compute_wait_s(&rules, &[1.0, 2.0]), 0.0);
        assert_eq!(compute_wait_s(&rules, &[]), 0.0);
    }

    #[test]
    fn waits_until_oldest_expires_at_limit() {
        let rules = vec![Rule {
            max: 2,
            window_s: 10,
            penalty_s: 60,
        }];
        // Two requests 3s and 7s ago fill the window; the 7s-old one gates.
        let wait = compute_wait_s(&rules, &[3.0, 7.0]);
        assert!((wait - 3.0).abs() < 1e-9, "wait = {wait}");
    }

    #[test]
    fn over_limit_waits_for_enough_slots() {
        let rules = vec![Rule {
            max: 2,
            window_s: 10,
            penalty_s: 60,
        }];
        // Three in-window requests: two must expire; the 5s-old one gates.
        let wait = compute_wait_s(&rules, &[1.0, 5.0, 9.0]);
        assert!((wait - 5.0).abs() < 1e-9, "wait = {wait}");
    }

    #[test]
    fn most_restrictive_rule_wins() {
        let rules = vec![
            Rule {
                max: 10,
                window_s: 10,
                penalty_s: 60,
            },
            Rule {
                max: 1,
                window_s: 60,
                penalty_s: 60,
            },
        ];
        let wait = compute_wait_s(&rules, &[30.0]);
        assert!((wait - 30.0).abs() < 1e-9, "wait = {wait}");
    }

    #[test]
    fn requests_outside_window_are_ignored() {
        let rules = vec![Rule {
            max: 1,
            window_s: 10,
            penalty_s: 60,
        }];
        assert_eq!(compute_wait_s(&rules, &[11.0, 200.0]), 0.0);
    }
}
