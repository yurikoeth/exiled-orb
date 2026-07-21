import type { ButtonHTMLAttributes, HTMLAttributes } from "react";

/**
 * Shared UI primitives — the handful of visual patterns repeated across the
 * overlay. Every component should build panels/buttons/labels from these
 * instead of re-declaring the inline style objects.
 */

/** Shared color tokens (previously scattered as literals). */
export const COLORS = {
  green: "#44cc44",
  red: "#ff4444",
  redSoft: "#ff6666",
  orange: "#ffaa00",
} as const;

/** PoE rarity → display color. */
export const RARITY_COLORS: Record<string, string> = {
  Normal: "#c8c8c8",
  Magic: "#8888ff",
  Rare: "#ffff77",
  Unique: "#af6025",
  Gem: "#1ba29b",
  Currency: "#aa9e82",
  "Divination Card": "#66cccc",
};

/** high/medium/low priority → display color (AI upgrade suggestions). */
export const PRIORITY_COLORS: Record<string, string> = {
  high: COLORS.red,
  medium: COLORS.orange,
  low: COLORS.green,
};

// --- Panel ------------------------------------------------------------------

const PANEL_BG = {
  /** Standard panel gradient. */
  default: "linear-gradient(180deg, rgba(24,24,28,0.95) 0%, rgba(14,14,18,0.95) 100%)",
  /** Slightly translucent variant (list rows, secondary tiles). */
  dim: "linear-gradient(180deg, rgba(24,24,28,0.9) 0%, rgba(14,14,18,0.9) 100%)",
  /** Brighter "selected/expanded" gradient. */
  raised: "linear-gradient(180deg, rgba(30,30,36,0.95) 0%, rgba(18,18,22,0.95) 100%)",
  /** Purple-tinted (Live Session tile). */
  purple: "linear-gradient(180deg, rgba(28,24,40,0.95) 0%, rgba(16,14,22,0.95) 100%)",
  /** Amber-tinted (gear capture panel). */
  amber: "linear-gradient(180deg, rgba(40,30,20,0.95) 0%, rgba(20,16,12,0.95) 100%)",
  /** Flat dark (nested cards, editors). */
  flat: "rgba(18,18,22,0.9)",
  /** Near-transparent (empty states, hidden-list manager). */
  faint: "rgba(255,255,255,0.03)",
} as const;

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  bg?: keyof typeof PANEL_BG;
  /** Gold border instead of the default border color. */
  gold?: boolean;
  /** Dashed border (empty-state boxes). */
  dashed?: boolean;
}

/** The rounded gradient box used by every overlay panel. Padding via className. */
export function Panel({ bg = "default", gold = false, dashed = false, className = "", style, children, ...rest }: PanelProps) {
  return (
    <div
      className={`rounded border ${className}`}
      style={{
        background: PANEL_BG[bg],
        borderColor: gold ? "var(--border-gold)" : "var(--border-color)",
        borderStyle: dashed ? "dashed" : "solid",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

// --- Btn --------------------------------------------------------------------

type BtnVariant = "ghost" | "outline" | "gold" | "green" | "danger" | "text";
type BtnSize = "xs" | "sm" | "action";

export interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  /** Toggle state — gold/green variants get their filled "active" look. */
  active?: boolean;
  size?: BtnSize;
}

const BTN_SIZE: Record<BtnSize, string> = {
  xs: "text-xs px-1.5 py-0.5",
  sm: "text-xs px-2 py-1",
  action: "text-xs py-1.5 px-2 font-bold uppercase tracking-wide",
};

function btnStyle(variant: BtnVariant, active: boolean): React.CSSProperties {
  switch (variant) {
    case "gold":
      return {
        background: active ? "rgba(180,140,60,0.2)" : "rgba(255,255,255,0.08)",
        border: "1px solid var(--border-gold)",
        color: "var(--accent)",
      };
    case "green":
      return active
        ? { background: "rgba(68,204,68,0.15)", border: `1px solid ${COLORS.green}`, color: COLORS.green }
        : { background: "rgba(255,255,255,0.06)", border: "1px solid var(--border-color)", color: "var(--text-secondary)" };
    case "danger":
      return {
        background: "rgba(255,68,68,0.08)",
        border: "1px solid rgba(255,68,68,0.3)",
        color: COLORS.redSoft,
      };
    case "outline":
      return {
        background: "rgba(255,255,255,0.06)",
        border: "1px solid var(--border-color)",
        color: "var(--text-primary)",
      };
    case "text":
      return { background: "transparent", color: "var(--text-secondary)" };
    case "ghost":
    default:
      return { background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)" };
  }
}

/** Small overlay button. Variants cover the recurring bg/border/color combos. */
export function Btn({ variant = "ghost", active = false, size = "xs", className = "", style, children, ...rest }: BtnProps) {
  return (
    <button
      className={`${BTN_SIZE[size]} rounded transition-opacity hover:opacity-80 disabled:opacity-50 ${className}`}
      style={{ ...btnStyle(variant, active), ...style }}
      {...rest}
    >
      {children}
    </button>
  );
}

// --- SectionTitle -----------------------------------------------------------

/** Uppercase gold section heading. */
export function SectionTitle({ className = "", style, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`text-xs font-bold uppercase tracking-wide ${className}`}
      style={{ color: "var(--accent)", ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
