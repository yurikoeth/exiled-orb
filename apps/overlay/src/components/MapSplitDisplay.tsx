import { useEffect, useState, useRef } from "react";
import { useSpeedrunStore } from "../stores/speedrun-store";
import { formatDuration } from "@exiled-orb/shared";

/** Generate a short PB chime as a data URL (avoids needing an external audio file) */
function createPbChime(): string {
  const sampleRate = 22050;
  const duration = 0.35;
  const samples = Math.floor(sampleRate * duration);
  const buffer = new Float32Array(samples);

  // Two-tone ascending chime (C5 -> E5)
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate;
    const freq = t < 0.15 ? 523.25 : 659.25; // C5 then E5
    const envelope = Math.exp(-t * 6) * 0.3;
    buffer[i] = Math.sin(2 * Math.PI * freq * t) * envelope;
  }

  // Encode as 16-bit WAV
  const wavBuffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(wavBuffer);
  const writeStr = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) {
    view.setInt16(
      44 + i * 2,
      Math.max(-32768, Math.min(32767, Math.round(buffer[i] * 32767))),
      true
    );
  }

  const blob = new Blob([wavBuffer], { type: "audio/wav" });
  return URL.createObjectURL(blob);
}

let pbChimeUrl: string | null = null;

function playPbChime() {
  if (!pbChimeUrl) pbChimeUrl = createPbChime();
  const audio = new Audio(pbChimeUrl);
  audio.volume = 0.5;
  audio.play().catch(() => {});
}

/**
 * Shows pending run awaiting Clear/Brick decision.
 * Stays visible until the user chooses — no auto-hide.
 * After resolving, briefly shows the result then fades.
 */
export default function MapSplitDisplay() {
  const pendingRun = useSpeedrunStore((s) => s.pendingRun);
  const lastRun = useSpeedrunStore((s) => s.lastCompletedRun);
  const personalBests = useSpeedrunStore((s) => s.personalBests);
  const newPb = useSpeedrunStore((s) => s.newPb);
  const playedRef = useRef<string | null>(null);
  const [resolvedVisible, setResolvedVisible] = useState(false);

  // After resolving, show result briefly then hide
  useEffect(() => {
    if (lastRun) {
      setResolvedVisible(true);
      const timer = setTimeout(() => setResolvedVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastRun]);

  // Play PB chime when resolved as completed PB
  useEffect(() => {
    if (newPb && lastRun && playedRef.current !== lastRun.id) {
      playedRef.current = lastRun.id;
      playPbChime();
    }
  }, [newPb, lastRun]);

  // Pending run — awaiting user decision (no auto-hide)
  if (pendingRun && pendingRun.totalMs != null) {
    const pb = personalBests.get(pendingRun.mapName);

    return (
      <div
        className="rounded-lg border px-3 py-2 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200"
        style={{
          backgroundColor: "var(--bg-panel)",
          borderColor: "rgba(255, 200, 50, 0.5)",
          boxShadow: "0 0 8px rgba(255, 200, 50, 0.2)",
        }}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {pendingRun.mapName} — cleared or bricked?
          </span>
          <span className="text-sm font-bold font-mono" style={{ color: "var(--text-primary)" }}>
            {formatDuration(pendingRun.totalMs)}
          </span>
        </div>

        {pb != null && pendingRun.totalMs != null && (
          <div className="text-right mt-0.5">
            <span
              className={`text-xs font-mono ${pendingRun.totalMs <= pb ? "text-green-400" : "text-red-400"}`}
            >
              {pendingRun.totalMs <= pb ? "New PB! " : ""}
              vs PB {formatDuration(pb)}
            </span>
          </div>
        )}

        {/* Clear / Brick buttons */}
        <div className="flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => useSpeedrunStore.getState().resolveRun("completed")}
              className="text-xs px-3 py-1 rounded font-bold transition-all"
              style={{
                background: "rgba(34,197,94,0.2)",
                color: "#22c55e",
                border: "1px solid rgba(34,197,94,0.4)",
              }}
            >
              Clear
            </button>
            <button
              onClick={() => useSpeedrunStore.getState().resolveRun("bricked")}
              className="text-xs px-3 py-1 rounded font-bold transition-all"
              style={{
                background: "rgba(239,68,68,0.2)",
                color: "#ef4444",
                border: "1px solid rgba(239,68,68,0.4)",
              }}
            >
              Brick
            </button>
          </div>
          {pendingRun.deaths > 0 && (
            <span className="text-xs text-red-400">
              {pendingRun.deaths} death{pendingRun.deaths !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Resolved run — show briefly after user chose
  if (!resolvedVisible || !lastRun || lastRun.totalMs == null) return null;

  const isBricked = lastRun.outcome === "bricked";
  const pb = personalBests.get(lastRun.mapName);
  const isPb = !isBricked && pb != null && lastRun.totalMs <= pb;
  const diff = !isBricked && pb != null ? lastRun.totalMs - pb : null;

  return (
    <div
      className="rounded-lg border px-3 py-2 backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-200"
      style={{
        backgroundColor: "var(--bg-panel)",
        borderColor: isBricked
          ? "rgba(239, 68, 68, 0.5)"
          : isPb
            ? "rgba(34, 197, 94, 0.5)"
            : "var(--border-color)",
        boxShadow: isBricked
          ? "0 0 12px rgba(239, 68, 68, 0.3)"
          : isPb
            ? "0 0 12px rgba(34, 197, 94, 0.3)"
            : "none",
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: isBricked ? "#ef4444" : "#22c55e" }}>
          {lastRun.mapName} {isBricked ? "BRICKED" : "CLEARED"}
        </span>
        <span
          className={`text-sm font-bold font-mono ${isPb ? "text-green-400" : ""}`}
          style={isPb ? {} : { color: "var(--text-primary)" }}
        >
          {formatDuration(lastRun.totalMs)}
        </span>
      </div>

      {diff != null && (
        <div className="text-right mt-0.5">
          <span className={`text-xs font-mono ${diff <= 0 ? "text-green-400" : "text-red-400"}`}>
            {diff <= 0 ? "PB! " : ""}
            {diff > 0 ? "+" : ""}
            {formatDuration(Math.abs(diff))}
          </span>
        </div>
      )}

      {lastRun.deaths > 0 && (
        <div className="text-xs text-red-400 mt-0.5">
          {lastRun.deaths} death{lastRun.deaths !== 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}
