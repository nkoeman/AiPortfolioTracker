"use client";

type ChatLauncherButtonProps = {
  onClick: () => void;
};

export function ChatLauncherButton({ onClick }: ChatLauncherButtonProps) {
  return (
    <button
      type="button"
      className="chat-launcher-button"
      aria-label="Open Portfolio Assistant"
      onClick={onClick}
    >
      <span className="chat-launcher-icon" aria-hidden="true">
        AI
      </span>
      <span>Portfolio Assistant</span>
    </button>
  );
}
