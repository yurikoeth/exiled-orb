import { useSpeedrunStore } from "../stores/speedrun-store";
import { formatDuration } from "@exiled-orb/shared";
import { SectionTitle } from "./ui";

const WIDTH = 280;
const HEIGHT = 80;
const PAD = { top: 4, right: 4, bottom: 14, left: 4 };
const CHART_W = WIDTH - PAD.left - PAD.right;
const CHART_H = HEIGHT - PAD.top - PAD.bottom;

/** Pure SVG sparkline chart showing run times over time */
export default function RunTimeChart() {
  const session = useSpeedrunStore((s) => s.session);
  const personalBests = useSpeedrunStore((s) => s.personalBests);

  if (!session) return null;

  const completed = session.maps.filter((m) => m.completed && m.totalMs != null);
  if (completed.length < 2) return null;

  // Use last 20 runs
  const runs = completed.slice(-20);
  const times = runs.map((r) => r.totalMs!);
  const yMin = Math.min(...times) * 0.9;
  const yMax = Math.max(...times) * 1.1;
  const yRange = yMax - yMin || 1;
  const avgMs = times.reduce((a, b) => a + b, 0) / times.length;

  const toX = (i: number) => PAD.left + (i / (runs.length - 1)) * CHART_W;
  const toY = (ms: number) => PAD.top + CHART_H - ((ms - yMin) / yRange) * CHART_H;

  // Build polyline points
  const points = runs.map((_, i) => `${toX(i)},${toY(times[i])}`).join(" ");

  // Track running PBs to color dots
  const runningPbs: boolean[] = [];
  let best = Infinity;
  for (const t of times) {
    if (t < best) {
      best = t;
      runningPbs.push(true);
    } else {
      runningPbs.push(false);
    }
  }

  // Overall PB line
  const overallPb = Math.min(...[...personalBests.values()].filter((v) => v > 0), ...times);
  const pbY = toY(overallPb);
  const avgY = toY(avgMs);

  return (
    <div
      className="rounded-lg border px-2 py-1.5 backdrop-blur-sm"
      style={{ backgroundColor: "var(--bg-panel)", borderColor: "var(--border-color)" }}
    >
      <SectionTitle className="mb-1">Run Times ({runs.length} recent)</SectionTitle>

      <svg
        width={WIDTH}
        height={HEIGHT}
        className="w-full"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
      >
        {/* Average line */}
        {avgY >= PAD.top && avgY <= PAD.top + CHART_H && (
          <>
            <line
              x1={PAD.left}
              y1={avgY}
              x2={PAD.left + CHART_W}
              y2={avgY}
              stroke="rgba(255,255,255,0.2)"
              strokeWidth={1}
              strokeDasharray="4,3"
            />
            <text
              x={PAD.left + CHART_W - 2}
              y={avgY - 2}
              textAnchor="end"
              fontSize={8}
              fill="rgba(255,255,255,0.4)"
            >
              avg {formatDuration(avgMs)}
            </text>
          </>
        )}

        {/* PB line */}
        {overallPb < Infinity && pbY >= PAD.top && pbY <= PAD.top + CHART_H && (
          <>
            <line
              x1={PAD.left}
              y1={pbY}
              x2={PAD.left + CHART_W}
              y2={pbY}
              stroke="rgba(34,197,94,0.3)"
              strokeWidth={1}
              strokeDasharray="4,3"
            />
            <text x={PAD.left + 2} y={pbY - 2} fontSize={8} fill="rgba(34,197,94,0.6)">
              PB {formatDuration(overallPb)}
            </text>
          </>
        )}

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />

        {/* Dots */}
        {runs.map((_, i) => (
          <circle
            key={i}
            cx={toX(i)}
            cy={toY(times[i])}
            r={runningPbs[i] ? 3 : 2}
            fill={runningPbs[i] ? "#22c55e" : "var(--accent)"}
            stroke={runningPbs[i] ? "#22c55e" : "none"}
            strokeWidth={1}
          />
        ))}

        {/* X-axis labels */}
        <text x={PAD.left} y={HEIGHT - 2} fontSize={8} fill="rgba(255,255,255,0.3)">
          1
        </text>
        <text
          x={PAD.left + CHART_W}
          y={HEIGHT - 2}
          textAnchor="end"
          fontSize={8}
          fill="rgba(255,255,255,0.3)"
        >
          {runs.length}
        </text>

        {/* Y-axis labels */}
        <text x={PAD.left} y={PAD.top + 8} fontSize={8} fill="rgba(255,255,255,0.3)">
          {formatDuration(yMax)}
        </text>
        <text x={PAD.left} y={PAD.top + CHART_H} fontSize={8} fill="rgba(255,255,255,0.3)">
          {formatDuration(yMin)}
        </text>
      </svg>
    </div>
  );
}
