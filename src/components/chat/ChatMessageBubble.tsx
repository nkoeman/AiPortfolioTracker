"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { PortfolioChatMessage } from "@/components/chat/types";

type ChatMessageBubbleProps = {
  message: PortfolioChatMessage;
};

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isAssistant = message.role === "assistant";
  const normalizedContent = isAssistant
    ? message.content.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
    : message.content;

  return (
    <div className={`chat-message-row ${isAssistant ? "assistant" : "user"}`}>
      <div className={`chat-message-bubble ${isAssistant ? "assistant" : "user"}`}>
        {isAssistant ? (
          <div className="chat-message-content chat-markdown">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <p className="chat-md-heading">{children}</p>,
                h2: ({ children }) => <p className="chat-md-heading">{children}</p>,
                h3: ({ children }) => <p className="chat-md-heading">{children}</p>
              }}
            >
              {normalizedContent}
            </ReactMarkdown>
          </div>
        ) : (
          <div className="chat-message-content">{normalizedContent}</div>
        )}
      </div>
    </div>
  );
}
