import React, { useState, useMemo } from 'react';
import { Copy, Check, Bot, User, AlertCircle } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { ChatMessage } from '../services/api';

interface MessageBubbleProps {
  message: ChatMessage;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const [copied, setCopied] = useState(false);
  const isAssistant = message.role === 'assistant';
  const isUser = message.role === 'user';

  // Format markdown content safely
  const sanitizedHtml = useMemo(() => {
    if (!isAssistant || !message.content) return '';
    try {
      // Parse markdown synchronously
      const rawHtml = marked.parse(message.content, {
        breaks: true,
        gfm: true,
      }) as string;

      // Sanitize with DOMPurify allowing safe tags and attributes
      return DOMPurify.sanitize(rawHtml, {
        ADD_ATTR: ['target', 'rel'],
      });
    } catch {
      return message.content;
    }
  }, [message.content, isAssistant]);

  const handleCopy = async () => {
    if (!message.content) return;
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard fallback
      const textArea = document.createElement('textarea');
      textArea.value = message.content;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`message-row ${isUser ? 'user-row' : 'assistant-row'} ${
        message.error ? 'message-error' : ''
      }`}
    >
      {/* Role Avatar */}
      <div className="message-avatar" aria-hidden="true">
        {isUser ? (
          <User size={16} className="avatar-icon user-icon" />
        ) : (
          <Bot size={16} className="avatar-icon bot-icon" />
        )}
      </div>

      <div className="message-body">
        {/* Header row with role name, timestamp, and actions */}
        <div className="message-meta-row">
          <span className="message-author">
            {isUser ? 'You' : 'Nexus Assistant'}
          </span>
          <span className="message-time">{message.timestamp}</span>

          {isAssistant && !message.error && message.content && (
            <button
              onClick={handleCopy}
              className={`copy-btn ${copied ? 'copied' : ''}`}
              title="Copy message to clipboard"
              aria-label={copied ? 'Copied to clipboard' : 'Copy assistant response'}
            >
              {copied ? (
                <>
                  <Check size={12} />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Message bubble card */}
        <div className="message-bubble-card">
          {message.error ? (
            <div className="bubble-error-text">
              <AlertCircle size={14} className="inline-error-icon" />
              <span>{message.content}</span>
            </div>
          ) : isAssistant ? (
            <div
              className="markdown-content"
              dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          ) : (
            <div className="plain-content">{message.content}</div>
          )}

          {/* Model badge */}
          {message.model && isAssistant && (
            <div className="model-provenance-tag">
              <span className="tag-dot"></span>
              <span>Model: {message.model}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
