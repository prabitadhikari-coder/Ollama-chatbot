import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ArrowDown, MessageSquare, Sparkles, BookOpen, ShieldCheck } from 'lucide-react';
import type { ChatMessage, ModelRole } from '../services/api';
import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { ErrorMessage } from './ErrorMessage';

interface MessageListProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  activeModelName: string;
  error: string | null;
  onRetry?: () => void;
  onDismissError?: () => void;
  onSelectPrompt: (prompt: string, role?: ModelRole) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isGenerating,
  activeModelName,
  error,
  onRetry,
  onDismissError,
  onSelectPrompt,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const userScrolledUpRef = useRef(false);

  // Check scroll position
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // If user scrolled up more than 90px, flag it and show jump button
    if (distanceFromBottom > 90) {
      userScrolledUpRef.current = true;
      setShowScrollBottom(true);
    } else {
      userScrolledUpRef.current = false;
      setShowScrollBottom(false);
    }
  }, []);

  // Auto-scroll when messages or generation changes, IF user has not scrolled up
  useEffect(() => {
    if (!containerRef.current) return;
    if (!userScrolledUpRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, isGenerating]);

  const scrollToBottom = () => {
    if (!containerRef.current) return;
    containerRef.current.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: 'smooth',
    });
    userScrolledUpRef.current = false;
    setShowScrollBottom(false);
  };

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="messages-scroll-area"
      aria-live="polite"
    >
      {/* Welcome state if no messages */}
      {messages.length === 0 ? (
        <div className="empty-chat-welcome">
          <div className="welcome-icon-box">
            <Sparkles size={28} className="text-indigo-500" />
          </div>
          <h3 className="welcome-title">How can I assist you today?</h3>
          <p className="welcome-desc">
            Powered by local Ollama neural models with enterprise security guardrails.
          </p>

          <div className="starter-prompts-grid">
            <button
              className="starter-prompt-card"
              onClick={() =>
                onSelectPrompt(
                  'Explain how this application securely connects Cloudflare Pages to local Ollama via ngrok.',
                  'chat'
                )
              }
            >
              <div className="prompt-header">
                <MessageSquare size={14} className="text-blue-500" />
                <span>Architecture</span>
              </div>
              <p>How does the Cloudflare Pages to ngrok tunnel connection work?</p>
            </button>

            <button
              className="starter-prompt-card"
              onClick={() =>
                onSelectPrompt(
                  'Summarize key security considerations for rate limiting and CORS on local AI endpoints.',
                  'reading'
                )
              }
            >
              <div className="prompt-header">
                <ShieldCheck size={14} className="text-emerald-500" />
                <span>Security</span>
              </div>
              <p>What security controls protect my local GPU from unauthorized access?</p>
            </button>

            <button
              className="starter-prompt-card"
              onClick={() =>
                onSelectPrompt(
                  'Analyze the differences in use-cases between Nemotron Mini and Nemotron 3 Nano.',
                  'reading'
                )
              }
            >
              <div className="prompt-header">
                <BookOpen size={14} className="text-indigo-500" />
                <span>Model Intelligence</span>
              </div>
              <p>When should I use Nemotron Mini vs Nemotron 3 Nano?</p>
            </button>
          </div>
        </div>
      ) : (
        <div className="messages-flow">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onSelectFollowUp={(p) => onSelectPrompt(p)}
            />
          ))}

          {/* Typing Indicator */}
          {isGenerating && <TypingIndicator modelName={activeModelName} />}

          {/* Error Banner inside stream if applicable */}
          {error && (
            <ErrorMessage
              message={error}
              onRetry={onRetry}
              onDismiss={onDismissError}
            />
          )}
        </div>
      )}

      {/* Floating Jump to Bottom Button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="jump-to-bottom-btn"
          aria-label="Scroll to bottom of chat"
          title="Scroll to latest message"
        >
          <ArrowDown size={14} />
          <span>New messages below</span>
        </button>
      )}
    </div>
  );
};
