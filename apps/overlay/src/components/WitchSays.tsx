import type { ReactNode } from "react";
import witchImg from "../assets/classes/elementalist.png";
import { Panel } from "./ui";

/** Wraps AI-generated content in a "Witch is speaking" style card */
export default function WitchSays({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <Panel gold className="relative overflow-hidden">
      {/* Witch portrait + speech area */}
      <div className="flex">
        {/* Portrait */}
        <div
          className="shrink-0 w-14 relative"
          style={{
            backgroundImage: `url(${witchImg})`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            minHeight: 56,
          }}
        >
          {/* Fade edge */}
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(to right, transparent 40%, rgba(14,14,18,0.95) 100%)",
            }}
          />
        </div>

        {/* Speech content */}
        <div className="flex-1 px-3 py-2 min-w-0">
          {title && (
            <div className="text-xs font-bold mb-1 italic" style={{ color: "var(--accent)" }}>
              {title}
            </div>
          )}
          <div className="text-xs" style={{ color: "var(--text-primary)", lineHeight: 1.6 }}>
            {children}
          </div>
        </div>
      </div>
    </Panel>
  );
}
