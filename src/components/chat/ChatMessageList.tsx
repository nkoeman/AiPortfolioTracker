"use client";

import { ChatMessageBubble } from "@/components/chat/ChatMessageBubble";
import type { PortfolioChatMessage } from "@/components/chat/types";

type ChatMessageListProps = {
  messages: PortfolioChatMessage[];
  loading: boolean;
};

export function ChatMessageList({ messages, loading }: ChatMessageListProps) {
  return (
    <div className="chat-message-list" aria-live="polite">
      {messages.map((message) => (
        <ChatMessageBubble key={message.id} message={message} />
      ))}
      {loading ? (
        <div className="chat-message-row assistant">
          <div className="chat-message-bubble assistant">
            <span className="chat-typing" aria-label="Assistant is typing">
              <span />
              <span />
              <span />
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
