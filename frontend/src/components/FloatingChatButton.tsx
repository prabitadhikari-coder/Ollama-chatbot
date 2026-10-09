import React from 'react';
import { MessageSquare, Sparkles, X } from 'lucide-react';

interface FloatingChatButtonProps {
  isOpen: boolean;
  isMinimized: boolean;
  onToggle: () => void;
  unreadCount?: number;
  isOnline: boolean;
}

export const FloatingChatButton: React.FC<FloatingChatButtonProps> = ({
  isOpen,
  isMinimized,
  onToggle,
  unreadCount = 0,
  isOnline,
}) => {
  return (
    <button
      id="chat-toggle"
      className={`floating-chat-btn ${isOpen && !isMinimized ? 'active' : ''}`}
      onClick={onToggle}
      aria-label={isOpen && !isMinimized ? 'Minimize chat assistant' : 'Open AI chat assistant'}
      aria-expanded={isOpen && !isMinimized}
      title={isOpen && !isMinimized ? 'Minimize chat panel' : 'Open AI chat panel'}
    >
      <div className="btn-icon-wrapper">
        {isOpen && !isMinimized ? (
          <X size={26} className="btn-icon" />
        ) : (
          <>
            <MessageSquare size={26} className="btn-icon" />
            <Sparkles size={14} className="sparkle-badge" />
          </>
        )}
      </div>

      {/* Online / status indicator dot on the button */}
      <span
        className={`floating-status-dot ${isOnline ? 'online' : 'offline'}`}
        title={isOnline ? 'Ollama server connected' : 'Ollama disconnected'}
      />

      {/* Unread badge if any */}
      {unreadCount > 0 && !isOpen && (
        <span className="unread-counter">{unreadCount}</span>
      )}
    </button>
  );
};
