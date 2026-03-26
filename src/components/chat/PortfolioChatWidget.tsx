"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { ChatLauncherButton } from "@/components/chat/ChatLauncherButton";
import { ChatOverlay } from "@/components/chat/ChatOverlay";
import type { PortfolioChatApiResult, PortfolioChatMessage } from "@/components/chat/types";

const STORAGE_KEY_PREFIX = "portfolio-chat-session-v1";

const STARTER_PROMPTS = [
  "Why is my portfolio down recently?",
  "How risky is my portfolio?",
  "Is my portfolio sensitive to oil prices?"
];

function createMessage(role: "user" | "assistant", content: string): PortfolioChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    createdAt: Date.now()
  };
}

function parseStoredMessages(raw: string | null): PortfolioChatMessage[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row) => row && typeof row === "object")
      .map((row) => {
        const value = row as Record<string, unknown>;
        return {
          id: typeof value.id === "string" ? value.id : `${Date.now()}-${Math.random()}`,
          role: value.role === "assistant" ? "assistant" : "user",
          content: typeof value.content === "string" ? value.content : "",
          createdAt: typeof value.createdAt === "number" ? value.createdAt : Date.now()
        } as PortfolioChatMessage;
      })
      .filter((row) => row.content.trim().length > 0)
      .slice(-30);
  } catch {
    return [];
  }
}

export function PortfolioChatWidget() {
  const { isLoaded, user } = useUser();
  const normalizedEmail = user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() || null;
  const userKey = isLoaded && user ? normalizedEmail : null;
  const storageKey = userKey ? `${STORAGE_KEY_PREFIX}:${userKey}` : null;

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<PortfolioChatMessage[]>([]);
  const messagesRef = useRef<PortfolioChatMessage[]>([]);

  useEffect(() => {
    if (!storageKey) {
      setMessages([]);
      return;
    }
    const stored = parseStoredMessages(window.sessionStorage.getItem(storageKey));
    if (stored.length) setMessages(stored);
    else setMessages([]);
    setError(null);
    setOpen(false);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    messagesRef.current = messages;
    window.sessionStorage.setItem(storageKey, JSON.stringify(messages.slice(-30)));
  }, [messages, storageKey]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || loading || !storageKey) return;
      setError(null);
      const nextUserMessage = createMessage("user", content.trim());
      const nextMessages = [...messagesRef.current, nextUserMessage];
      setMessages(nextMessages);
      setLoading(true);

      try {
        const response = await fetch("/api/chat/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content.trim(),
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

        const result = body as PortfolioChatApiResult;
        const assistantMessage = createMessage("assistant", result.message);
        setMessages((current) => [...current, assistantMessage]);
      } catch (chatError) {
        setError(chatError instanceof Error ? chatError.message : "Unable to fetch assistant response.");
        setMessages((current) => [
          ...current,
          createMessage(
            "assistant",
            "I'm unable to answer right now. Please try again in a moment."
          )
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, storageKey]
  );

  const clearHistory = useCallback(() => {
    if (!storageKey) return;
    if (!messagesRef.current.length) return;
    const confirmed = window.confirm("Clear your chat history for this account?");
    if (!confirmed) return;
    window.sessionStorage.removeItem(storageKey);
    messagesRef.current = [];
    setMessages([]);
    setError(null);
  }, [storageKey]);

  if (!storageKey) {
    return null;
  }

  return (
    <>
      <ChatLauncherButton onClick={() => setOpen(true)} />
      <ChatOverlay
        open={open}
        loading={loading}
        error={error}
        messages={messages}
        starterPrompts={STARTER_PROMPTS}
        onClose={() => setOpen(false)}
        onClearHistory={clearHistory}
        onSendMessage={sendMessage}
      />
    </>
  );
}
