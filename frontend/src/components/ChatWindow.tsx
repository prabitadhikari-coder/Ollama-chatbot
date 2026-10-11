import React, { useState, useEffect } from 'react';
import type { ChatMessage, ModelRole, ServerStatus } from '../services/api';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

interface ChatWindowProps {
  isOpen: boolean;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onClose: () => void;
  messages: ChatMessage[];
  isGenerating: boolean;
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onNewChat: () => void;
  onExportChat?: () => void;
  status: ServerStatus | null;
  checkingStatus: boolean;
  onRefreshStatus: () => void;
  role: ModelRole;
  onRoleChange: (role: ModelRole) => void;
  error: string | null;
  onRetry?: () => void;
  onDismissError?: () => void;
  onSelectPrompt: (prompt: string, role?: ModelRole) => void;
  activeModelName: string;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  isOpen,
  isMinimized,
  onToggleMinimize,
  onClose,
  messages,
  isGenerating,
  input,
  setInput,
  onSend,
  onStop,
  onNewChat,
  onExportChat,
  status,
  checkingStatus,
  onRefreshStatus,
  role,
  onRoleChange,
  error,
  onRetry,
  onDismissError,
  onSelectPrompt,
  activeModelName,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  // Close on Escape key if open and not generating
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isMinimized) {
        onToggleMinimize();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isMinimized, onToggleMinimize]);

  if (!isOpen) return null;

  const isOffline = !status?.connected || !status?.chatModelAvailable;

  return (
    <section
      id="chat-panel"
      className={`chat-panel-container ${isMinimized ? 'minimized' : ''} ${
        isMaximized ? 'maximized' : ''
      }`}
      aria-label="Nexus AI Assistant chat dialog"
      role="dialog"
      aria-modal="false"
    >
      <ChatHeader
        status={status}
        checkingStatus={checkingStatus}
        onRefreshStatus={onRefreshStatus}
        role={role}
        onRoleChange={onRoleChange}
        onNewChat={onNewChat}
        onExportChat={onExportChat}
        isMinimized={isMinimized}
        onToggleMinimize={onToggleMinimize}
        isMaximized={isMaximized}
        onToggleMaximize={() => setIsMaximized((prev) => !prev)}
        onClose={onClose}
        isGenerating={isGenerating}
      />

      {/* When not minimized, show message list and input */}
      {!isMinimized && (
        <div className="chat-window-content">
          <MessageList
            messages={messages}
            isGenerating={isGenerating}
            activeModelName={activeModelName}
            error={error}
            onRetry={onRetry}
            onDismissError={onDismissError}
            onSelectPrompt={onSelectPrompt}
          />

          <ChatInput
            input={input}
            setInput={setInput}
            onSend={onSend}
            onStop={onStop}
            isGenerating={isGenerating}
            disabled={isOffline}
          />
        </div>
      )}
    </section>
  );
};
