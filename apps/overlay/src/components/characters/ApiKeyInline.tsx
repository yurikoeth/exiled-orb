import { useState, useEffect } from "react";
import { getStore, persistToStore } from "../../utils/store";
import { Btn, COLORS, Panel } from "../ui";

/** Inline Claude API key setup shown on the Characters tab. */
export default function ApiKeyInline() {
  const [show, setShow] = useState(false);
  const [key, setKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getStore().then((store) => {
      store.get<string>("claude_api_key").then((k) => {
        if (k) { setKey(k); setSaved(true); }
      });
    }).catch(() => {});
  }, []);

  const save = async () => {
    await persistToStore("claude_api_key", key.trim());
    setSaved(true);
  };

  return (
    <Panel bg="flat" className="px-3 py-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: saved ? COLORS.green : "var(--text-secondary)" }}>
          {saved ? "API Key Set" : "Claude API Key"}
        </span>
        <Btn onClick={() => setShow(!show)}>{show ? "Hide" : "Edit"}</Btn>
      </div>
      {show && (
        <div className="flex gap-1.5 mt-1.5">
          <input
            type="password"
            value={key}
            onChange={(e) => { setKey(e.target.value); setSaved(false); }}
            placeholder="sk-ant-..."
            className="flex-1 px-2 py-1 rounded text-xs"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-color)", color: "var(--text-primary)" }}
          />
          <Btn variant={saved ? "green" : "outline"} active={saved} size="sm" onClick={save}>
            {saved ? "Saved" : "Save"}
          </Btn>
        </div>
      )}
    </Panel>
  );
}
