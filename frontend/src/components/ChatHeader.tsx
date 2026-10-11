import React from 'react';
import {
  Bot,
  Minimize2,
  Maximize2,
  X,
  RotateCcw,
  Sparkles,
  BookOpen,
  MessageSquare,
  Download,
} from 'lucide-react';
import type { ModelRole, ServerStatus } from '../services/api';
import { ConnectionStatus } from './ConnectionStatus';

interface ChatHeaderProps {
  status: ServerStatus | null;
  checkingStatus: boolean;
  onRefreshStatus: () => void;
  role: ModelRole;
  onRoleChange: (role: ModelRole) => void;
  onNewChat: () => void;
  onExportChat?: () => void;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  isMaximized: boolean;
  onToggleMaximize: () => void;
  onClose: () => void;
  isGenerating: boolean;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  status,
  checkingStatus,
  onRefreshStatus,
  role,
  onRoleChange,
  onNewChat,
  onExportChat,
  isMinimized,
  onToggleMinimize,
  isMaximized,
  onToggleMaximize,
  onClose,
  isGenerating,
}) => {
  return (
    <div className="chat-header-container">
      {/* Top Header Row */}
      <div className="chat-header-main">
        <div className="chat-title-group">
          <div className="header-bot-badge">
            <Bot size={18} />
          </div>
          <div>
            <div className="header-title-text">
              <span className="font-semibold">Nexus AI Assistant</span>
            </div>
            <ConnectionStatus
              status={status}
              checking={checkingStatus}
              onRefresh={onRefreshStatus}
            />
          </div>
        </div>

        {/* Action Window Buttons */}
        <div className="chat-header-controls">
          {/* Export Chat Button */}
          {onExportChat && (
            <button
              onClick={onExportChat}
              className="header-action-btn"
              title="Export Conversation (Markdown)"
              aria-label="Export conversation"
            >
              <Download size={15} />
            </button>
          )}

          <button
            onClick={onNewChat}
            disabled={isGenerating}
            className="header-action-btn"
            title="Start new conversation"
            aria-label="New conversation"
          >
            <RotateCcw size={15} />
          </button>

          <button
            onClick={onToggleMinimize}
            className="header-action-btn"
            title={isMinimized ? 'Restore chat window' : 'Minimize chat window'}
            aria-label={isMinimized ? 'Restore chat' : 'Minimize chat'}
          >
            <Minimize2 size={15} />
          </button>

          <button
            onClick={onToggleMaximize}
            className="header-action-btn"
            title={isMaximized ? 'Restore standard size' : 'Expand full screen'}
            aria-label={isMaximized ? 'Standard size' : 'Expand full screen'}
          >
            <Maximize2 size={15} />
          </button>

          <button
            onClick={onClose}
            className="header-action-btn close-btn"
            title="Close chat"
            aria-label="Close chat"
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Model Selection Bar */}
      <div className="chat-model-bar">
        <div className="model-bar-label">
          <Sparkles size={13} className="text-indigo-400" />
          <span>Active Engine:</span>
        </div>

        <div className="model-selector-group">
          <button
            type="button"
            className={`model-chip ${role === 'chat' ? 'active' : ''}`}
            onClick={() => onRoleChange('chat')}
            title="General Chat & Coding (nemotron-mini:latest)"
          >
            <MessageSquare size={13} />
            <span>Chat: Nemotron Mini</span>
          </button>

          <button
            type="button"
            className={`model-chip ${role === 'reading' ? 'active' : ''}`}
            onClick={() => onRoleChange('reading')}
            title="Document Analysis & Database Extraction (nemotron-3-nano:4b)"
          >
            <BookOpen size={13} />
            <span>Reading: Nemotron Nano</span>
          </button>
        </div>
      </div>
    </div>
  );
};
