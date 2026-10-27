import FundExplorer from "./FundExplorer";
import { useEffect, useRef, useState } from "react";
import "./App.css";

const suggestions = [
  {
    icon: "🌱",
    title: "Understand SIPs",
    text: "Explain SIP investing to a beginner with a simple example.",
  },
  {
    icon: "⚖️",
    title: "Compare funds",
    text: "What should I compare before choosing two mutual funds?",
  },
  {
    icon: "📈",
    title: "Learn about returns",
    text: "Explain CAGR, XIRR and absolute returns in simple words.",
  },
  {
    icon: "🛡️",
    title: "Understand risk",
    text: "How can I understand the risk level of a mutual fund?",
  },
];

function App() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage(text = message) {
    const question = text.trim();
    if (!question || loading) return;

    setMessage("");
    setError("");
    setMessages((prev) => [
      ...prev,
      { role: "user", text: question },
    ]);
    setLoading(true);

    try {
      const response = await fetch("http://127.0.0.1:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "The request failed.");
      }

      if (!data.reply) {
        throw new Error("The AI returned an empty response.");
      }

      setMessages((prev) => [
        ...prev,
        { role: "ai", text: data.reply },
      ]);
    } catch (err) {
      console.error("Chat request failed:", err);
      setError(
        "I couldn't reach the AI service. Please check that your backend is running, then try again."
      );
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function startNewChat() {
    setMessages([]);
    setMessage("");
    setError("");
    inputRef.current?.focus();
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home" onClick={startNewChat}>
          <div className="brand-mark">
            R<span>α</span>
          </div>
          <div className="brand-copy">
            <strong>Roll Alpha</strong>
            <span>INTELLIGENT INVESTING</span>
          </div>
        </a>

        <button className="new-chat" onClick={startNewChat}>
          <span className="plus-icon">＋</span>
          New conversation
        </button>

        <div className="sidebar-label">EXPLORE</div>

        <button className="nav-item active" onClick={startNewChat}>
          <span>✳</span> AI Assistant
        </button>

        <button
          className="nav-item"
          onClick={() =>
            sendMessage(
              "Teach me how to compare mutual funds using reliable metrics."
            )
          }
        >
          <span>◫</span> Fund analysis
        </button>

        <button
          className="nav-item"
          onClick={() =>
            sendMessage(
              "Explain SIP, lump sum investing and the difference between them."
            )
          }
        >
          <span>↗</span> SIP learning
        </button>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon">✦</div>
            <strong>Invest with clarity.</strong>
            <p>Learn the numbers before making a decision.</p>
          </div>

          <div className="sidebar-foot">
            <span className="online-dot" />
            AI assistant
            <span className="version">BETA</span>
          </div>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="crumb-divider">/</span>
            <strong>AI Assistant</strong>
          </div>

          <div className="topbar-right">
            <span className="secure-label">
              ✦ Built for smarter investing
            </span>
            <div className="avatar">RA</div>
          </div>
        </header>

        {/* Mutual fund search and latest NAV explorer */}
        <FundExplorer />

        <section className="chat-layout">
          <div className="chat-heading">
            <div>
              <div className="eyebrow">
                <span className="sparkle">✦</span> YOUR FINANCIAL COPILOT
              </div>

              <h1>
                Make sense of your <span>investments.</span>
              </h1>

              <p>
                Ask questions, understand fund metrics, and learn to invest
                with more confidence.
              </p>
            </div>

            <div className="assistant-status">
              <span className="online-dot" />
              Ready to help
            </div>
          </div>

          <div className="conversation">
            {messages.length === 0 ? (
              <div className="welcome-content" id="home">
                <div className="welcome-orb">
                  <span>✳</span>
                  <i className="orb-dot dot-one" />
                  <i className="orb-dot dot-two" />
                </div>

                <div className="welcome-title">
                  <h2>
                    What would you like to <span>understand?</span>
                  </h2>
                  <p>
                    From your first SIP to comparing fund performance,
                    let's break it down together.
                  </p>
                </div>

                <div className="suggestion-grid">
                  {suggestions.map((item) => (
                    <button
                      className="suggestion-card"
                      key={item.title}
                      onClick={() => sendMessage(item.text)}
                      disabled={loading}
                    >
                      <span className="suggestion-icon">
                        {item.icon}
                      </span>
                      <span className="suggestion-title">
                        {item.title}
                      </span>
                      <span className="suggestion-text">
                        {item.text}
                      </span>
                      <span className="suggestion-arrow">↗</span>
                    </button>
                  ))}
                </div>

                <div className="tip-line">
                  <span>✧</span>
                  Tip: Ask a specific question for a more useful explanation.
                </div>
              </div>
            ) : (
              <div className="message-list">
                {messages.map((item, index) => (
                  <article
                    key={`${index}-${item.role}`}
                    className={`message-row ${item.role}`}
                  >
                    <div className={`message-avatar ${item.role}`}>
                      {item.role === "user" ? "You" : "Rα"}
                    </div>

                    <div className="message-content">
                      <div className="message-author">
                        {item.role === "user" ? "You" : "Roll Alpha AI"}

                        {item.role === "ai" && (
                          <span className="ai-tag">AI ASSISTANT</span>
                        )}
                      </div>

                      <div className="message-bubble">
                        {item.text}
                      </div>
                    </div>
                  </article>
                ))}

                {loading && (
                  <article className="message-row ai">
                    <div className="message-avatar ai">Rα</div>

                    <div className="message-content">
                      <div className="message-author">
                        Roll Alpha AI
                      </div>

                      <div className="message-bubble typing-bubble">
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-dot" />
                        <span className="typing-label">
                          Thinking through your question…
                        </span>
                      </div>
                    </div>
                  </article>
                )}

                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="composer-area">
            {error && (
              <div className="error-message" role="alert">
                <span>⚠</span>
                <span>{error}</span>
                <button
                  onClick={() => setError("")}
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </div>
            )}

            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage();
              }}
            >
              <textarea
                ref={inputRef}
                rows={1}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask anything about mutual funds..."
                aria-label="Your message"
                disabled={loading}
              />

              <div className="composer-footer">
                <span className="composer-hint">
                  <kbd>↵</kbd> to send
                  <span className="hint-divider">·</span>{" "}
                  <kbd>Shift + ↵</kbd> for a new line
                </span>

                <button
                  type="submit"
                  className="send-button"
                  disabled={loading || !message.trim()}
                  aria-label="Send message"
                >
                  {loading ? "…" : "Send"}
                  <span>↑</span>
                </button>
              </div>
            </form>

            <p className="disclaimer">
              Roll Alpha AI provides educational information, not personalized
              financial advice. Returns are not guaranteed.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
