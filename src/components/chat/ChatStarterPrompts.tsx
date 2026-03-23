"use client";

type ChatStarterPromptsProps = {
  prompts: string[];
  disabled?: boolean;
  onSelect: (prompt: string) => void;
};

export function ChatStarterPrompts({ prompts, disabled, onSelect }: ChatStarterPromptsProps) {
  return (
    <div className="chat-starter-prompts">
      {prompts.map((prompt) => (
        <button
          key={prompt}
          type="button"
          className="chat-starter-prompt"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
        >
          {prompt}
        </button>
      ))}
    </div>
  );
}
