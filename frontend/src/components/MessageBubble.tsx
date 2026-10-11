import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Bot,
  User,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Database,
  Code2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { ChatMessage } from '../services/api';

interface MessageBubbleProps {
  message: ChatMessage;
  onSelectFollowUp?: (prompt: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  onSelectFollowUp,
}) => {
  const [copied, setCopied] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [feedback, setFeedback] = useState<'liked' | 'disliked' | null>(null);
  const [showSqlInspector, setShowSqlInspector] = useState(false);

  const isAssistant = message.role === 'assistant';
  const isUser = message.role === 'user';

  // Detect SQL blocks in content to surface in Query Inspector
  const extractedSql = useMemo(() => {
    if (!isAssistant || !message.content) return null;
    const sqlMatch = message.content.match(/```sql\s*([\s\S]*?)\s*```/i);
    if (sqlMatch && sqlMatch[1]) {
      return sqlMatch[1].trim();
    }
    // Check for inline SELECT/FROM patterns if not fenced
    if (/SELECT\s+[\s\S]+?\s+FROM\s+/i.test(message.content)) {
      const match = message.content.match(/(SELECT[\s\S]+?(?:;|$))/i);
      return match ? match[1].trim() : null;
    }
    return null;
  }, [message.content, isAssistant]);

  // Format markdown content safely
  const sanitizedHtml = useMemo(() => {
    if (!isAssistant || !message.content) return '';
    try {
      const rawHtml = marked.parse(message.content, {
        breaks: true,
        gfm: true,
      }) as string;

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

  const handleCopySql = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!extractedSql) return;
    try {
      await navigator.clipboard.writeText(extractedSql);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } catch {
      // ignore
    }
  };

  // Generate contextual follow-up chips based on content
  const followUpSuggestions = useMemo(() => {
    if (!isAssistant || message.error || !message.content || message.content.length < 30) {
      return [];
    }
    const suggestions: string[] = [];
    if (extractedSql) {
      suggestions.push('Explain the SQL query logic');
      suggestions.push('Format results as a markdown table');
    } else if (message.content.includes('|') && message.content.includes('---')) {
      suggestions.push('Summarize key anomalies in this table');
      suggestions.push('Export these records as CSV');
    } else {
      suggestions.push('Can you provide an example with code/data?');
      suggestions.push('Break down the steps in more detail');
    }
    return suggestions.slice(0, 2);
  }, [isAssistant, message.error, message.content, extractedSql]);

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
            <div className="message-header-actions">
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

              {/* Feedback buttons */}
              <button
                onClick={() => setFeedback(feedback === 'liked' ? null : 'liked')}
                className={`feedback-btn ${feedback === 'liked' ? 'active-liked' : ''}`}
                title="Good response"
                aria-label="Thumbs up"
              >
                <ThumbsUp size={12} />
              </button>
              <button
                onClick={() => setFeedback(feedback === 'disliked' ? null : 'disliked')}
                className={`feedback-btn ${feedback === 'disliked' ? 'active-disliked' : ''}`}
                title="Needs improvement"
                aria-label="Thumbs down"
              >
                <ThumbsDown size={12} />
              </button>
            </div>
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
            <>
              {/* Collapsible SQL / Database Query Inspector */}
              {extractedSql && (
                <div className="query-inspector-card">
                  <div
                    className="query-inspector-header"
                    onClick={() => setShowSqlInspector(!showSqlInspector)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="inspector-title">
                      <Database size={13} className="text-indigo-500" />
                      <span>Database Query Inspector</span>
                      <span className="sql-tag">SQL</span>
                    </div>
                    <div className="inspector-controls">
                      <button
                        onClick={handleCopySql}
                        className="copy-sql-btn"
                        title="Copy SQL Query"
                      >
                        {copiedSql ? <Check size={11} /> : <Code2 size={11} />}
                        <span>{copiedSql ? 'Copied' : 'Copy Query'}</span>
                      </button>
                      {showSqlInspector ? (
                        <ChevronUp size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </div>
                  </div>

                  {showSqlInspector && (
                    <div className="query-code-preview">
                      <pre>
                        <code>{extractedSql}</code>
                      </pre>
                    </div>
                  )}
                </div>
              )}

              <div
                className="markdown-content"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
              />
            </>
          ) : (
            <div className="plain-content">{message.content}</div>
          )}

          {/* Model provenance & data source badge */}
          {message.model && isAssistant && (
            <div className="model-provenance-tag">
              <span className="tag-dot"></span>
              <span>Model: {message.model}</span>
              {extractedSql && (
                <>
                  <span className="tag-separator">&bull;</span>
                  <span className="tag-db">Data Query Synced</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Suggested contextual follow-up chips */}
        {isAssistant && followUpSuggestions.length > 0 && onSelectFollowUp && (
          <div className="followup-chips-row">
            {followUpSuggestions.map((suggestion, idx) => (
              <button
                key={idx}
                className="followup-chip"
                onClick={() => onSelectFollowUp(suggestion)}
              >
                <Sparkles size={11} className="text-indigo-400" />
                <span>{suggestion}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
