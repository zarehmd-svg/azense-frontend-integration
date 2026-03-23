import { useState } from "react";

const API_BASE =
  import.meta.env.VITE_API_BASE || "https://azense-backend.onrender.com";

export function ChatPanel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/teaching-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok) {
        throw new Error(`Teaching chat error: ${res.status}`);
      }
      const json = await res.json();
      const assistantMessage = {
        role: "assistant",
        content:
          json.reply ||
          "I couldn't generate a detailed teaching response. Please try again.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error(err);
      const assistantMessage = {
        role: "assistant",
        content:
          "I wasn't able to reach the AZense teaching service. "
          + "Please try again in a moment.",
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        borderRadius: 12,
        padding: 10,
        marginTop: 16,
        maxHeight: 320,
        display: "flex",
        flexDirection: "column",
        width: "100%",
        background:
          "linear-gradient(145deg, rgba(79,70,229,0.06), rgba(129,140,248,0.03))",
        border: "1px solid rgba(79,70,229,0.30)",
      }}
    >
      {/* Header styled like the purple Azense for Residents pill */}
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          padding: "4px 10px",
          borderRadius: "999px",
          border: "1px solid rgba(79,70,229,0.9)",
          background:
            "linear-gradient(135deg, #4F46E5 0%, #6366F1 40%, #818CF8 100%)",
          color: "#F9FAFB",
          fontSize: "11px",
          fontWeight: 600,
          marginBottom: 8,
          alignSelf: "flex-start",
        }}
      >
        AZense Teaching Chat (no PHI)
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          marginBottom: 8,
          paddingRight: 4,
        }}
      >
        {messages.length === 0 && (
          <div style={{ fontSize: 12, color: "#4B5563" }}>
            Ask about how AZense works, why it generated a certain assessment,
            or how to phrase documentation. Do not include real names, MRNs,
            dates of birth, or other PHI.
          </div>
        )}

        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              marginBottom: 6,
              fontSize: 13,
              textAlign: m.role === "user" ? "right" : "left",
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "6px 10px",
                borderRadius: 12,
                backgroundColor:
                  m.role === "user" ? "#e0f2fe" : "#f3f4f6",
                color: "#111827",
              }}
            >
              {m.content}
            </span>
          </div>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", gap: 8, marginTop: 4 }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about AZense (no PHI)..."
          style={{
            flex: 1,
            fontSize: 13,
            padding: "6px 8px",
            borderRadius: 6,
            border: "1px solid #ddd",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            fontSize: 13,
            padding: "6px 10px",
            borderRadius: 6,
            border: "none",
            backgroundColor: loading ? "#93C5FD" : "#2563eb",
            color: "white",
            cursor: loading ? "wait" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {loading ? "Thinking…" : "Send"}
        </button>
      </form>
    </div>
  );
}
