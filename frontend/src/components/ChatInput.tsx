import React, { useRef, useEffect } from 'react';
import { Send, Square, Sparkles } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSend,
  onStop,
  isGenerating,
  disabled,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 140)}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && !disabled && input.trim()) {
        onSend();
      }
    }
  };

  return (
    <form
      className="chat-input-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (isGenerating) {
          onStop();
        } else if (!disabled && input.trim()) {
          onSend();
        }
      }}
    >
      <div className="input-field-wrapper">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? 'Backend offline. Check Ollama and ngrok tunnel...'
              : 'Ask a question or enter a command... (Enter to send, Shift+Enter for newline)'
          }
          disabled={disabled && !isGenerating}
          rows={1}
          className="chat-textarea"
          aria-label="Chat input prompt"
        />

        <div className="input-action-buttons">
          {isGenerating ? (
            <button
              type="button"
              onClick={onStop}
              className="stop-generation-btn"
              title="Stop response generation"
              aria-label="Stop response generation"
            >
              <Square size={14} className="fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={disabled || !input.trim()}
              className="send-message-btn"
              title="Send message"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="input-subtext">
        <div className="subtext-left">
          <Sparkles size={11} />
          <span>Local Ollama Neural Core</span>
        </div>
        <div className="subtext-right">
          <span>Shift + Enter for new line</span>
        </div>
      </div>
    </form>
  );
};
