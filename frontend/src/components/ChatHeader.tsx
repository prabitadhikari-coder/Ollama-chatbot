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
  Shield,
} from 'lucide-react';
import type { ModelRole, ServerStatus, AuthUser, UserRole } from '../services/api';
import { ConnectionStatus } from './ConnectionStatus';

interface ChatHeaderProps {
  status: ServerStatus | null;
  checkingStatus: boolean;
  onRefreshStatus: () => void;
  role: ModelRole;
  onRoleChange: (role: ModelRole) => void;
  currentUser?: AuthUser;
  onQuickRoleChange?: (role: UserRole) => void;
  onOpenAuthModal?: () => void;
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
  currentUser,
  onQuickRoleChange,
  onOpenAuthModal,
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

      {/* Database Clearance & Role Switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          background: 'rgba(15, 23, 42, 0.75)',
          borderTop: '1px solid rgba(51, 65, 85, 0.4)',
          fontSize: '11px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Shield
            size={12}
            style={{
              color:
                currentUser?.role === 'admin'
                  ? '#a855f7'
                  : currentUser?.role === 'employee'
                  ? '#3b82f6'
                  : '#10b981',
            }}
          />
          <span style={{ color: '#94a3b8', fontWeight: 500 }}>Clearance:</span>
          <span
            style={{
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color:
                currentUser?.role === 'admin'
                  ? '#c084fc'
                  : currentUser?.role === 'employee'
                  ? '#60a5fa'
                  : '#34d399',
            }}
          >
            {currentUser?.role || 'customer'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={() => onQuickRoleChange?.('customer')}
            title="Public Catalog & Return Policies only"
            style={{
              padding: '2px 7px',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '11px',
              cursor: 'pointer',
              border: currentUser?.role === 'customer' ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid transparent',
              background: currentUser?.role === 'customer' ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
              color: currentUser?.role === 'customer' ? '#6ee7b7' : '#64748b',
              transition: 'all 0.15s ease',
            }}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => onQuickRoleChange?.('employee')}
            title="Unlock Customer Orders, Emails & Internal WiFi/VPN"
            style={{
              padding: '2px 7px',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '11px',
              cursor: 'pointer',
              border: currentUser?.role === 'employee' ? '1px solid rgba(59, 130, 246, 0.5)' : '1px solid transparent',
              background: currentUser?.role === 'employee' ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              color: currentUser?.role === 'employee' ? '#93c5fd' : '#64748b',
              transition: 'all 0.15s ease',
            }}
          >
            Employee
          </button>
          <button
            type="button"
            onClick={() => onQuickRoleChange?.('admin')}
            title="Unlock Full Executive Access: POs, Financials & Margins"
            style={{
              padding: '2px 7px',
              borderRadius: '4px',
              fontWeight: 600,
              fontSize: '11px',
              cursor: 'pointer',
              border: currentUser?.role === 'admin' ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid transparent',
              background: currentUser?.role === 'admin' ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
              color: currentUser?.role === 'admin' ? '#d8b4fe' : '#64748b',
              transition: 'all 0.15s ease',
            }}
          >
            Admin
          </button>
          {onOpenAuthModal && (
            <button
              type="button"
              onClick={onOpenAuthModal}
              title="Open full login / register account modal"
              style={{
                marginLeft: '4px',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                color: '#94a3b8',
                background: 'rgba(51, 65, 85, 0.3)',
                border: '1px solid rgba(71, 85, 105, 0.4)',
                cursor: 'pointer',
              }}
            >
              Account...
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
