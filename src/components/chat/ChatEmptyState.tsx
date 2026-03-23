"use client";

import { ChatStarterPrompts } from "@/components/chat/ChatStarterPrompts";

type ChatEmptyStateProps = {
  starterPrompts: string[];
  disabled?: boolean;
  onSelectPrompt: (prompt: string) => void;
};

export function ChatEmptyState({ starterPrompts, disabled, onSelectPrompt }: ChatEmptyStateProps) {
  return (
    <div className="chat-empty-state">
      <p>
        I can help explain your portfolio performance, largest positions, exposures, and transaction activity using
        your synced portfolio data.
      </p>
      <ChatStarterPrompts prompts={starterPrompts} disabled={disabled} onSelect={onSelectPrompt} />
      <small>
        Descriptive analysis only. No personalized investment, tax, or legal advice.
      </small>
    </div>
  );
}
