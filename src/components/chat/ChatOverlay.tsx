"use client";

import { useEffect, useRef } from "react";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatEmptyState } from "@/components/chat/ChatEmptyState";
import { ChatMessageList } from "@/components/chat/ChatMessageList";
import type { PortfolioChatMessage } from "@/components/chat/types";

type ChatOverlayProps = {
  open: boolean;
  loading: boolean;
  error: string | null;
  messages: PortfolioChatMessage[];
  starterPrompts: string[];
  onClose: () => void;
  onClearHistory: () => void;
  onSendMessage: (message: string) => Promise<void> | void;
};

export function ChatOverlay({
  open,
  loading,
  error,
  messages,
  starterPrompts,
  onClose,
  onClearHistory,
  onSendMessage
}: ChatOverlayProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);

  if (!open) return null;

  return (
    <div
      className="chat-overlay-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="chat-overlay-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="portfolio-assistant-title"
      >
        <header className="chat-overlay-header">
          <h3 id="portfolio-assistant-title">Your portfolio assistant</h3>
          <div className="chat-overlay-actions">
            <button
              type="button"
              className="secondary chat-overlay-clear"
              onClick={onClearHistory}
              aria-label="Clear chat history"
              disabled={!messages.length}
            >
              Clear
            </button>
            <button
              type="button"
              className="secondary chat-overlay-close-icon"
              onClick={onClose}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>
        </header>

        <div className="chat-overlay-body">
          {messages.length ? (
            <ChatMessageList messages={messages} loading={loading} />
          ) : (
            <ChatEmptyState
              starterPrompts={starterPrompts}
              disabled={loading}
              onSelectPrompt={(prompt) => {
                void onSendMessage(prompt);
              }}
            />
          )}
          <div ref={endRef} />
        </div>

        {error ? <small className="warning-text chat-overlay-error">{error}</small> : null}

        <ChatComposer loading={loading} inputRef={inputRef} onSubmit={onSendMessage} />
      </section>
    </div>
  );
}
