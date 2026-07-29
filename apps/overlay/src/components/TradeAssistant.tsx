import { useAiStore } from "../stores/ai-store";
import WitchSays from "./WitchSays";

/** Trade whisper assistant — shows AI analysis of incoming trade messages */
export default function TradeAssistant() {
  const whisperAnalyses = useAiStore((s) => s.whisperAnalyses);

  // Only show the most recent analysis
  const latest = whisperAnalyses[0];
  if (!latest) return null;

  // Auto-hide after 30 seconds
  if (Date.now() - latest.timestamp > 30_000) return null;

  const { analysis, whisperText } = latest;

  return (
    <WitchSays title={analysis.isSuspiciousPrice ? "Suspicious Trade!" : "Trade Whisper"}>
      <div className="space-y-1.5">
        {/* Whisper text */}
        <div className="truncate" style={{ color: "var(--text-secondary)" }}>
          {whisperText}
        </div>

        {/* Suspicious warning */}
        {analysis.isSuspiciousPrice && analysis.suspiciousReason && (
          <div className="text-red-400">{analysis.suspiciousReason}</div>
        )}

        {/* Suggested response */}
        <div
          className="px-2 py-1.5 rounded cursor-pointer hover:opacity-80 transition-opacity"
          style={{ backgroundColor: "rgba(255, 255, 255, 0.06)", color: "var(--text-primary)" }}
          onClick={() => {
            navigator.clipboard.writeText(analysis.suggestedResponse);
          }}
          title="Click to copy response"
        >
          {analysis.suggestedResponse}
        </div>
        <div style={{ color: "var(--text-secondary)", fontSize: "0.6rem" }}>Click to copy</div>
      </div>
    </WitchSays>
  );
}
