import { useState } from "react";

export function ChatPanel() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage = { role: "user", content: trimmed };

    const assistantMessage = {
      role: "assistant",
      content:
        "This is a teaching-only chat. Avoid real patient identifiers. " +
        "Ask about what AZense is doing, how to interpret outputs, or " +
        "how to phrase documentation.",
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
  }

  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 12,
        marginTop: 16,
        maxHeight: 300,
        display: "flex",
        flexDirection: "column",
        width: "100%",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 8 }}>
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
          <div style={{ fontSize: 13, color: "#666" }}>
            Ask about how AZense works, why it generated a certain
            assessment, or how to phrase documentation. Do not include
            real names, MRNs, or dates of birth.
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
          style={{
            fontSize: 13,
            padding: "6px 10px",
            borderRadius: 6,
            border: "none",
            backgroundColor: "#2563eb",
            color: "white",
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
