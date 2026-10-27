import { useEffect, useRef, useState } from "react";
import { Bot, RefreshCw, Send, Trash2, User } from "lucide-react";
import { api } from "../lib/api.js";
import { useApi } from "../lib/useApi.js";
import { Button, Card, Disclaimer, Notice, PageHeader, inputCls } from "../components/ui.jsx";

const FALLBACK_SUGGESTIONS = [
  "What is XIRR?",
  "How do I compare two mutual funds?",
  "What is the difference between CAGR and XIRR?",
  "How does a SIP work?",
  "Explain the risk metrics of a mutual fund.",
];

// Tiny safe renderer: **bold**, _italic_, "- " bullets, "1. " lists. No HTML is injected.
function Inline({ text }) {
  return text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.length > 2 && part.startsWith("_") && part.endsWith("_")) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

function RichText({ text }) {
  const blocks = [];
  for (const line of text.split("\n")) {
    const bullet = line.match(/^\s*[-•]\s+(.*)/);
    const numbered = line.match(/^\s*\d+\.\s+(.*)/);
    const kind = bullet ? "ul" : numbered ? "ol" : line.trim() ? "p" : null;
    if (!kind) continue;
    const content = (bullet || numbered || [null, line])[1];
    const last = blocks[blocks.length - 1];
    if (kind !== "p" && last?.kind === kind) last.items.push(content);
    else blocks.push({ kind, items: [content] });
  }
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((b, i) =>
        b.kind === "p" ? <p key={i}><Inline text={b.items[0]} /></p> :
        b.kind === "ul" ? <ul key={i} className="list-disc space-y-1 pl-5">{b.items.map((t, j) => <li key={j}><Inline text={t} /></li>)}</ul> :
        <ol key={i} className="list-decimal space-y-1 pl-5">{b.items.map((t, j) => <li key={j}><Inline text={t} /></li>)}</ol>
      )}
    </div>
  );
}

export default function Chat() {
  const suggestions = useApi("/chat/suggestions");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [provider, setProvider] = useState(null);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading, error]);

  async function ask(history) {
    setLoading(true);
    setError(null);
    try {
      const r = await api.post("/chat", { messages: history.map(({ role, content }) => ({ role, content })) });
      setMessages([...history, { role: "assistant", content: r.reply }]);
      setProvider(r.provider);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function send(text) {
    const content = text.trim();
    if (!content || loading) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    ask(next);
  }

  function clear() { setMessages([]); setError(null); setInput(""); setProvider(null); }

  const questions = suggestions.data?.questions || FALLBACK_SUGGESTIONS;

  return (
    <>
      <PageHeader
        title="RollAlpha AI Assistant"
        subtitle="Ask what a term means or how to read a comparison. It explains concepts; it doesn't predict returns or tell you what to buy."
        actions={messages.length > 0 && <Button variant="ghost" onClick={clear}><Trash2 className="h-4 w-4" aria-hidden /> Clear conversation</Button>}
      />

      {provider === "fallback" && (
        <div className="mb-4"><Notice kind="warn" title="Limited mode">The AI service isn't connected, so only a few common questions are answered.</Notice></div>
      )}

      <Card className="flex h-[calc(100vh-15rem)] min-h-[420px] flex-col p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-5" aria-live="polite">
          {messages.length === 0 && (
            <div>
              <p className="font-display text-lg font-semibold">What would you like to understand?</p>
              <p className="mt-1 text-sm text-slate-600">Pick a question or type your own.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {questions.map((q) => (
                  <button key={q} onClick={() => send(q)} className="rounded-full border border-navy-200 bg-white px-3.5 py-2 text-left text-sm font-medium text-navy-800 hover:bg-navy-100">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-900 text-white"><Bot className="h-4 w-4" aria-label="Assistant" /></span>}
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-navy-900 text-white" : "bg-canvas"}`}>
                {m.role === "user" ? <p className="whitespace-pre-wrap text-sm">{m.content}</p> : <RichText text={m.content} />}
              </div>
              {m.role === "user" && <span className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-navy-100 text-navy-800"><User className="h-4 w-4" aria-label="You" /></span>}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3" role="status">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-navy-900 text-white"><Bot className="h-4 w-4" aria-hidden /></span>
              <span className="flex gap-1 rounded-2xl bg-canvas px-4 py-3" aria-label="Assistant is typing">
                {[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d * 120}ms` }} />)}
              </span>
            </div>
          )}

          {error && (
            <Notice kind="error" title="That message didn't go through" action={<Button variant="ghost" onClick={() => ask(messages)}><RefreshCw className="h-4 w-4" aria-hidden /> Retry</Button>}>
              {error}
            </Notice>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="flex gap-2 border-t border-navy-100 p-4">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder="Ask about XIRR, SIP, risk metrics…"
            aria-label="Your message"
            maxLength={2000}
            className={`${inputCls} resize-none`}
          />
          <Button type="submit" disabled={!input.trim() || loading} aria-label="Send message"><Send className="h-4 w-4" aria-hidden /> Send</Button>
        </form>
      </Card>
      <Disclaimer className="mt-4" />
    </>
  );
}
