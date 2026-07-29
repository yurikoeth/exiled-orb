import { useState, useRef, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getApiKey, getStore, persistToStore } from "../utils/store";
import { useBuildStore } from "../stores/build-store";
import WitchSays from "./WitchSays";
import { Btn } from "./ui";

interface Message {
  role: "user" | "ai";
  text: string;
  image?: string;
}

interface SavedChat {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

export default function AskAi() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingImage, setPendingImage] = useState<{
    base64: string;
    mediaType: string;
    dataUrl: string;
  } | null>(null);
  const [savedChats, setSavedChats] = useState<SavedChat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [showChatList, setShowChatList] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load saved chats on mount
  useEffect(() => {
    getStore()
      .then((store) => {
        store.get<SavedChat[]>("ai_chats").then((chats) => {
          if (chats) setSavedChats(chats);
        });
      })
      .catch((err) => console.error("[ExiledOrb]", err));
  }, []);

  const saveChatsToStore = async (chats: SavedChat[]) => {
    // Strip images from saved chats to avoid huge storage
    const stripped = chats.map((c) => ({
      ...c,
      messages: c.messages.map((m) => ({ ...m, image: undefined })),
    }));
    await persistToStore("ai_chats", stripped);
  };

  const saveCurrentChat = async () => {
    if (messages.length === 0) return;
    const title = messages[0].text.substring(0, 40) + (messages[0].text.length > 40 ? "..." : "");
    const id = currentChatId || `chat-${Date.now()}`;

    const updated = savedChats.filter((c) => c.id !== id);
    const chat: SavedChat = { id, title, messages, timestamp: Date.now() };
    updated.unshift(chat);
    // Keep last 20 chats
    const trimmed = updated.slice(0, 20);
    setSavedChats(trimmed);
    setCurrentChatId(id);
    await saveChatsToStore(trimmed);
  };

  const loadChat = (chat: SavedChat) => {
    setMessages(chat.messages);
    setCurrentChatId(chat.id);
    setShowChatList(false);
  };

  const newChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setShowChatList(false);
  };

  const deleteChat = async (id: string) => {
    const updated = savedChats.filter((c) => c.id !== id);
    setSavedChats(updated);
    await saveChatsToStore(updated);
    if (currentChatId === id) newChat();
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const [header, base64] = dataUrl.split(",");
      const mediaType = header.match(/data:(.*?);/)?.[1] || "image/png";
      setPendingImage({ base64, mediaType, dataUrl });
    };
    reader.readAsDataURL(file);
  }, []);

  // Handle paste
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) handleFile(file);
        }
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [handleFile]);

  // Handle drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const ask = async () => {
    const question = input.trim();
    if (!question || loading) return;

    const apiKey = await getApiKey();

    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "No API key set. To chat with the Witch, add your Claude API key in Settings > AI. You can get one at console.anthropic.com. Price checking and mod analysis still work without it.",
        },
      ]);
      setLoading(false);
      return;
    }

    const currentImage = pendingImage;
    setMessages((prev) => [
      ...prev,
      { role: "user", text: question, image: currentImage?.dataUrl },
    ]);
    setInput("");
    setPendingImage(null);
    setLoading(true);

    try {
      // Include active build context so the Witch knows what we're playing
      const ab = useBuildStore.getState().activeBuild;
      let buildContext = "";
      if (ab) {
        const hasGearDetail = ab.gearSummary && !ab.gearSummary.startsWith("(no gear data");
        buildContext = `\n\n[Active Build Context]\nCharacter: ${ab.characterName} (${ab.characterClass}, Lv.${ab.level}, ${ab.game})\nDamage: ${ab.damageTypes.join(", ") || "unknown"}\nDefense: ${ab.defenseTypes.join(", ") || "unknown"}\nRecovery: ${ab.recoveryTypes.join(", ") || "unknown"}\nKey Uniques: ${ab.keyItems.join(", ") || "none"}${ab.goal ? `\nBuild Goal: ${ab.goal.buildName} (Focus: ${ab.goal.focus.join(", ")}, Budget: ${ab.goal.budget})${ab.goal.notes ? `\nNotes: ${ab.goal.notes}` : ""}` : ""}${hasGearDetail ? `\n\n[Gear Snapshot]\n${ab.gearSummary}` : ""}`;
      }

      const history = messages
        .slice(-6)
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
        .join("\n");
      const fullQuestion = (history ? `${history}\nUser: ${question}` : question) + buildContext;

      let result: string;
      if (currentImage) {
        result = await invoke("ask_poe_with_image", {
          apiKey,
          question: fullQuestion,
          imageBase64: currentImage.base64,
          mediaType: currentImage.mediaType,
        });
      } else {
        result = await invoke("ask_poe_question", {
          apiKey,
          question: fullQuestion,
        });
      }

      setMessages((prev) => {
        const updated = [...prev, { role: "ai" as const, text: result }];
        // Auto-save after response
        setTimeout(() => saveCurrentChat(), 100);
        return updated;
      });
    } catch (err) {
      setMessages((prev) => [...prev, { role: "ai" as const, text: `Error: ${err}` }]);
    }
    setLoading(false);
  };

  const activeBuild = useBuildStore((s) => s.activeBuild);

  return (
    <div className="flex flex-col" style={{ height: 420 }}>
      {/* Chat controls */}
      <div className="flex items-center gap-1 mb-2">
        <Btn variant="outline" size="sm" style={{ color: "var(--accent)" }} onClick={newChat}>
          + New
        </Btn>
        <Btn
          variant="outline"
          size="sm"
          style={{ color: "var(--text-secondary)" }}
          onClick={() => setShowChatList(!showChatList)}
        >
          History ({savedChats.length})
        </Btn>
        {messages.length > 0 && (
          <Btn
            variant="outline"
            size="sm"
            style={{ color: "var(--text-secondary)" }}
            onClick={saveCurrentChat}
          >
            Save
          </Btn>
        )}
      </div>

      {/* Chat list */}
      {showChatList && (
        <div className="mb-2 space-y-0.5 max-h-40 overflow-y-auto">
          {savedChats.length === 0 && (
            <div className="text-xs text-center py-2" style={{ color: "var(--text-secondary)" }}>
              No saved chats
            </div>
          )}
          {savedChats.map((chat) => (
            <div
              key={chat.id}
              className="flex items-center justify-between rounded border px-2 py-1 cursor-pointer hover:opacity-80"
              style={{
                background:
                  currentChatId === chat.id ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.02)",
                borderColor:
                  currentChatId === chat.id ? "var(--border-gold)" : "var(--border-color)",
              }}
              onClick={() => loadChat(chat)}
            >
              <div className="min-w-0">
                <div className="text-xs truncate" style={{ color: "var(--text-primary)" }}>
                  {chat.title}
                </div>
                <div
                  className="text-xs"
                  style={{ color: "var(--text-secondary)", fontSize: "0.6rem" }}
                >
                  {chat.messages.length} messages — {new Date(chat.timestamp).toLocaleDateString()}
                </div>
              </div>
              <Btn
                variant="text"
                className="px-1 py-0 shrink-0 ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  deleteChat(chat.id);
                }}
              >
                ✕
              </Btn>
            </div>
          ))}
        </div>
      )}

      {/* Active build context indicator */}
      {activeBuild && (
        <div
          className="rounded border px-2 py-1 mb-2 flex items-center justify-between"
          style={{ background: "rgba(255,255,255,0.03)", borderColor: "var(--border-color)" }}
        >
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Context: <span style={{ color: "var(--accent)" }}>{activeBuild.characterName}</span> —{" "}
            {activeBuild.characterClass} Lv.{activeBuild.level}
            {activeBuild.goal && <span> ({activeBuild.goal.buildName})</span>}
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2 mb-2"
        style={{ minHeight: 0 }}
      >
        {messages.length === 0 && (
          <div className="text-xs text-center py-4" style={{ color: "var(--text-secondary)" }}>
            Ask anything about Path of Exile — builds, mechanics, crafting, economy, boss
            strategies...
          </div>
        )}

        {messages.map((msg, i) =>
          msg.role === "user" ? (
            <div
              key={i}
              className="rounded border px-3 py-2"
              style={{
                background: "rgba(255,255,255,0.04)",
                borderColor: "rgba(255,255,255,0.08)",
              }}
            >
              {msg.image && (
                <img src={msg.image} alt="" className="max-h-32 rounded mb-1 object-contain" />
              )}
              <div className="text-xs whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>
                {msg.text}
              </div>
            </div>
          ) : (
            <WitchSays key={i}>
              <div className="whitespace-pre-wrap">{msg.text}</div>
            </WitchSays>
          )
        )}

        {loading && (
          <div className="text-xs text-center py-2" style={{ color: "var(--text-secondary)" }}>
            Thinking...
          </div>
        )}
      </div>

      {/* Pending image preview */}
      {pendingImage && (
        <div className="flex items-center gap-2 mb-1">
          <img src={pendingImage.dataUrl} alt="" className="h-10 rounded object-contain" />
          <Btn onClick={() => setPendingImage(null)}>✕</Btn>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-1.5" onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <Btn
          variant="outline"
          className="px-2 py-1.5"
          style={{
            background: "rgba(255,255,255,0.04)",
            color: pendingImage ? "var(--accent)" : "var(--text-secondary)",
          }}
          onClick={() => fileInputRef.current?.click()}
          title="Upload image (or paste/drop)"
        >
          📷
        </Btn>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask()}
          placeholder={
            pendingImage ? "Ask about this image..." : "Ask about PoE... (paste images too)"
          }
          className="flex-1 px-2 py-1.5 rounded text-xs"
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid var(--border-color)",
            color: "var(--text-primary)",
          }}
          disabled={loading}
        />
        <Btn
          variant="gold"
          className="px-3 py-1.5 font-bold"
          style={{ background: "rgba(255,255,255,0.06)" }}
          onClick={ask}
          disabled={loading || (!input.trim() && !pendingImage)}
        >
          Ask
        </Btn>
      </div>
    </div>
  );
}
