import { useState, useEffect } from "react";
import { useSettingsStore } from "../stores/settings-store";
import { fetchNinjaCached } from "../utils/ninja-cache";
import type { Game, NinjaLine } from "@exiled-orb/shared";
import { buildNinjaUrl, parseNinjaResponse, resolveLeague } from "@exiled-orb/shared";
import poe1Logo from "../assets/poe1-logo.png";
import poe2Logo from "../assets/poe2-logo.png";
import { COLORS, Panel } from "./ui";

type NinjaItem = NinjaLine;

type Category =
  | "Currency"
  | "Fragment"
  | "DivinationCard"
  | "UniqueWeapon"
  | "UniqueArmour"
  | "SkillGem"
  | "Map"
  | "Essence"
  | "Scarab";

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "Currency", label: "Currency" },
  { id: "Fragment", label: "Fragments" },
  { id: "DivinationCard", label: "Div Cards" },
  { id: "UniqueWeapon", label: "Uniques" },
  { id: "SkillGem", label: "Gems" },
  { id: "Essence", label: "Essences" },
  { id: "Scarab", label: "Scarabs" },
];

/** PoE2 economy data currently comes from the exchange only (verified 2026-07-30). */
const POE2_CATEGORIES: Category[] = ["Currency"];

function categoriesFor(game: Game): { id: Category; label: string }[] {
  return game === "poe2" ? CATEGORIES.filter((c) => POE2_CATEGORIES.includes(c.id)) : CATEGORIES;
}

async function fetchCategory(game: Game, league: string, category: Category): Promise<NinjaItem[]> {
  const url = buildNinjaUrl(game, league, category);

  let raw: string;
  try {
    raw = await fetchNinjaCached(url);
  } catch (err) {
    throw new Error(`Fetch failed: ${err}`);
  }
  // Check for HTML error pages
  if (raw.trimStart().startsWith("<!")) {
    throw new Error("League not found on poe.ninja. Check your league name in settings.");
  }
  return parseNinjaResponse(JSON.parse(raw)).sort((a, b) => b.chaosValue - a.chaosValue);
}

function MarketItem({ item }: { item: NinjaItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Panel
      bg={expanded ? "raised" : "dim"}
      gold={expanded}
      className="cursor-pointer hover:opacity-90 transition-opacity"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="px-2 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          {item.icon && <img src={item.icon} alt="" className="w-5 h-5 shrink-0 object-contain" />}
          <span className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
            {item.name}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold" style={{ color: "var(--accent)" }}>
            {item.chaosValue >= 1 ? Math.round(item.chaosValue) : item.chaosValue.toFixed(2)}c
          </span>
          {item.change !== 0 && (
            <span
              className="text-xs"
              style={{ color: item.change > 0 ? COLORS.green : COLORS.red, fontSize: "0.65rem" }}
            >
              {item.change > 0 ? "+" : ""}
              {item.change.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {expanded && (
        <div
          className="px-2 pb-2 pt-1 border-t space-y-1"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          {item.divineValue > 0 && (
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Divine value: {item.divineValue.toFixed(2)} div
            </div>
          )}
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Chaos value: {item.chaosValue.toFixed(1)}c
          </div>
          <div
            className="text-xs flex items-center gap-1"
            style={{
              color:
                item.change > 0
                  ? COLORS.green
                  : item.change < 0
                    ? COLORS.red
                    : "var(--text-secondary)",
            }}
          >
            7-day trend: {item.change > 0 ? "+" : ""}
            {item.change.toFixed(1)}%{item.change > 5 && " — Rising fast"}
            {item.change < -5 && " — Dropping"}
          </div>
        </div>
      )}
    </Panel>
  );
}

export default function MarketTab() {
  const settingsGame = useSettingsStore((s) => s.settings.game);
  const leagues = useSettingsStore((s) => s.settings.leagues);
  const [game, setGame] = useState<Game>(settingsGame);
  const [category, setCategory] = useState<Category>("Currency");
  const [items, setItems] = useState<NinjaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, category, leagues]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchCategory(game, resolveLeague(game, leagues), category);
      setItems(data);
    } catch (err) {
      setError(String(err));
      setItems([]);
    }
    setLoading(false);
  };

  const filtered = search
    ? items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()))
    : items.slice(0, 50);

  return (
    <div className="space-y-2">
      {/* Game toggle */}
      <div className="flex gap-1">
        {(["poe1", "poe2"] as const).map((g) => (
          <button
            key={g}
            onClick={() => {
              setGame(g);
              // Keep the selected category valid for the target game.
              if (!categoriesFor(g).some((c) => c.id === category)) setCategory("Currency");
            }}
            className="flex-1 py-1.5 rounded flex items-center justify-center transition-all"
            style={{
              background: game === g ? "rgba(255,255,255,0.08)" : "transparent",
              border: game === g ? "1px solid var(--border-gold)" : "1px solid var(--border-color)",
              opacity: game === g ? 1 : 0.4,
            }}
          >
            <img src={g === "poe1" ? poe1Logo : poe2Logo} alt={g} className="h-4" />
          </button>
        ))}
      </div>

      {/* Category selector */}
      <div className="flex gap-0.5 flex-wrap">
        {categoriesFor(game).map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className="px-2 py-1 rounded text-xs transition-all"
            style={{
              background: category === cat.id ? "rgba(255,255,255,0.08)" : "transparent",
              border:
                category === cat.id ? "1px solid var(--border-gold)" : "1px solid transparent",
              color: category === cat.id ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search..."
        className="w-full px-2 py-1.5 rounded text-xs"
        style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid var(--border-color)",
          color: "var(--text-primary)",
        }}
      />

      {/* Items list */}
      {loading && (
        <div className="text-xs text-center py-3" style={{ color: "var(--text-secondary)" }}>
          Loading prices...
        </div>
      )}
      {error && <div className="text-xs text-red-400">{error}</div>}

      <div className="space-y-0.5">
        {filtered.map((item, i) => (
          <MarketItem key={i} item={item} />
        ))}
      </div>
    </div>
  );
}
