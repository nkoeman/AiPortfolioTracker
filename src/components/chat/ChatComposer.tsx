"use client";

import { useState, type KeyboardEvent, type RefObject } from "react";

type ChatComposerProps = {
  loading: boolean;
  inputRef?: RefObject<HTMLTextAreaElement>;
  onSubmit: (message: string) => Promise<void> | void;
};

export function ChatComposer({ loading, inputRef, onSubmit }: ChatComposerProps) {
  const [value, setValue] = useState("");

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    setValue("");
    await onSubmit(trimmed);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div className="chat-composer">
      <textarea
        ref={inputRef}
        className="chat-composer-input"
        rows={2}
        placeholder="Ask a question about your portfolio..."
        value={value}
        disabled={loading}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="chat-composer-send"
        disabled={loading || !value.trim().length}
        onClick={() => {
          void submit();
        }}
      >
        {loading ? "Thinking..." : "Send"}
      </button>
    </div>
  );
}
