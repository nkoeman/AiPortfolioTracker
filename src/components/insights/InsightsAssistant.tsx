"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PortfolioChatApiResult, PortfolioChatMessage } from "@/components/chat/types";

type InsightsAssistantProps = {
  starterPrompts: string[];
};

function createMessage(role: "user" | "assistant", content: string): PortfolioChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: Date.now()
  };
}

function formatTime(value: number) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function MarkdownMessage({ content }: { content: string }) {
  const normalized = content.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <p className="chat-md-heading">{children}</p>,
          h2: ({ children }) => <p className="chat-md-heading">{children}</p>,
          h3: ({ children }) => <p className="chat-md-heading">{children}</p>
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="insights-message-row assistant">
      <div className="insights-bubble assistant typing" aria-label="ETFMinded is typing">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function MessageThread({ messages, loading }: { messages: PortfolioChatMessage[]; loading: boolean }) {
  return (
    <div className="insights-thread-inner">
      <div className="insights-date-divider">Today</div>
      {messages.map((message) => {
        const isAssistant = message.role === "assistant";
        return (
          <div key={message.id} className={`insights-message-row ${isAssistant ? "assistant" : "user"}`}>
            {isAssistant ? <div className="insights-message-role">ETFMinded</div> : null}
            <div className={`insights-bubble ${isAssistant ? "assistant" : "user"}`}>
              {isAssistant ? <MarkdownMessage content={message.content} /> : message.content}
            </div>
            <span className="insights-message-time">{formatTime(message.createdAt)}</span>
          </div>
        );
      })}
      {loading ? <TypingIndicator /> : null}
    </div>
  );
}

function Composer({
  value,
  loading,
  placeholder,
  onChange,
  onFocus,
  onSubmit
}: {
  value: string;
  loading: boolean;
  placeholder: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onSubmit: () => void;
}) {
  const canSend = value.trim().length > 0 && !loading;

  return (
    <form
      className="insights-composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSubmit();
      }}
    >
      <button type="button" className="insights-composer-plus" aria-label="Add context">
        +
      </button>
      <input
        value={value}
        onFocus={onFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        disabled={loading}
      />
      <button type="submit" className={`insights-composer-send${canSend ? " enabled" : ""}`} disabled={!canSend}>
        Send
      </button>
    </form>
  );
}

export function InsightsAssistant({ starterPrompts }: InsightsAssistantProps) {
  const [messages, setMessages] = useState<PortfolioChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, loading, mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || loading) return;

      setInput("");
      setError(null);
      const userMessage = createMessage("user", trimmed);
      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setLoading(true);

      try {
        const response = await fetch("/api/chat/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            history: nextMessages.map((message) => ({
              role: message.role,
              content: message.content
            }))
          })
        });

        const body = (await response.json()) as PortfolioChatApiResult | { error?: string };
        if (!response.ok) {
          throw new Error(typeof body === "object" && body && "error" in body ? body.error || "Chat failed." : "Chat failed.");
        }

        setMessages((current) => [...current, createMessage("assistant", (body as PortfolioChatApiResult).message)]);
      } catch (chatError) {
        setError(chatError instanceof Error ? chatError.message : "Unable to fetch assistant response.");
        setMessages((current) => [
          ...current,
          createMessage("assistant", "I cannot answer right now. Please try again in a moment.")
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, messages]
  );

  const submitCurrentInput = () => {
    void sendMessage(input);
  };

  return (
    <>
      <aside className="assistant insights-assistant-desktop">
        <div className="assistant-head">
          <div className="assistant-orb">E</div>
          <div>
            <h3>Ask ETFMinded</h3>
            <p>Answers grounded in your holdings</p>
          </div>
        </div>

        <div className="assistant-thread">
          {messages.length ? (
            <MessageThread messages={messages} loading={loading} />
          ) : (
            <div className="assistant-empty">
              Ask about performance, exposure, concentration, transactions, or portfolio composition.
            </div>
          )}
          <div ref={endRef} />
        </div>

        {starterPrompts.length ? (
          <div className="suggest">
            {starterPrompts.map((prompt) => (
              <button key={prompt} type="button" className="suggest-chip" onClick={() => void sendMessage(prompt)} disabled={loading}>
                {prompt}
              </button>
            ))}
          </div>
        ) : null}

        {error ? <small className="warning-text">{error}</small> : null}

        <Composer
          value={input}
          loading={loading}
          placeholder="Ask anything about your portfolio..."
          onChange={setInput}
          onSubmit={submitCurrentInput}
        />
      </aside>

      <section className="assistant insights-assistant-mobile-card">
        <div className="assistant-head">
          <div className="assistant-orb">E</div>
          <div>
            <h3>Ask ETFMinded</h3>
            <p>Grounded in your holdings</p>
          </div>
        </div>
        <div className="suggest">
          {starterPrompts.slice(0, 3).map((prompt) => (
            <button
              key={prompt}
              type="button"
              className="suggest-chip"
              onClick={() => {
                setMobileOpen(true);
                void sendMessage(prompt);
              }}
              disabled={loading}
            >
              {prompt}
            </button>
          ))}
        </div>
        <Composer
          value={input}
          loading={loading}
          placeholder="Ask ETFMinded..."
          onChange={setInput}
          onFocus={() => setMobileOpen(true)}
          onSubmit={() => {
            setMobileOpen(true);
            submitCurrentInput();
          }}
        />
      </section>

      {mobileOpen ? (
        <section className="insights-mobile-chat" role="dialog" aria-modal="true" aria-label="Ask ETFMinded">
          <header className="insights-mobile-chat-head">
            <button type="button" className="icon-btn" onClick={() => setMobileOpen(false)} aria-label="Back to insights">
              ‹
            </button>
            <div className="assistant-orb">E</div>
            <div>
              <h3>ETFMinded</h3>
              <p>grounded in your holdings</p>
            </div>
          </header>

          <div className="insights-mobile-thread">
            {messages.length ? (
              <MessageThread messages={messages} loading={loading} />
            ) : (
              <div className="assistant-empty">Ask a question about your portfolio.</div>
            )}
            <div ref={endRef} />
          </div>

          {starterPrompts.length && !messages.length ? (
            <div className="suggest insights-mobile-suggest">
              {starterPrompts.slice(0, 3).map((prompt) => (
                <button key={prompt} type="button" className="suggest-chip" onClick={() => void sendMessage(prompt)} disabled={loading}>
                  {prompt}
                </button>
              ))}
            </div>
          ) : null}

          <Composer
            value={input}
            loading={loading}
            placeholder="Ask anything..."
            onChange={setInput}
            onSubmit={submitCurrentInput}
          />
        </section>
      ) : null}
    </>
  );
}
