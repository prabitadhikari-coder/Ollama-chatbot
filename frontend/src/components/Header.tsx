import React from 'react';
import { Bot, Shield, Activity, UserCircle } from 'lucide-react';
import type { ServerStatus } from '../services/api';

interface HeaderProps {
  status: ServerStatus | null;
  checking: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenChat: () => void;
  onOpenTunnelSettings: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  checking,
  activeTab,
  setActiveTab,
  onOpenChat,
  onOpenTunnelSettings,
}) => {
  const isOnline = status?.connected && status?.chatModelAvailable;

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Brand identity */}
        <div className="header-brand">
          <div className="brand-logo">
            <Bot className="brand-icon" size={24} />
          </div>
          <div className="brand-text">
            <div className="brand-title-row">
              <span className="brand-name">NexusAI</span>
              <span className="brand-edition">Enterprise Platform</span>
            </div>
            <div className="brand-subtitle">
              Locally Hosted Neural Intelligence &bull; Hybrid Cloud Mesh
            </div>
          </div>
        </div>

        {/* Navigation tabs */}
        <nav className="header-nav" aria-label="Main navigation">
          <button
            className={`nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Dashboard
          </button>
          <button
            className={`nav-tab ${activeTab === 'document-analysis' ? 'active' : ''}`}
            onClick={() => setActiveTab('document-analysis')}
          >
            Doc Intelligence
          </button>
          <button
            className={`nav-tab ${activeTab === 'architecture' ? 'active' : ''}`}
            onClick={() => setActiveTab('architecture')}
          >
            Mesh Architecture
          </button>
          <button
            className={`nav-tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            Security &amp; API
          </button>
        </nav>

        {/* Right controls */}
        <div className="header-actions">
          {/* Connection status badge (clickable to open tunnel settings) */}
          <button
            type="button"
            className={`status-badge ${
              checking ? 'checking' : isOnline ? 'online' : 'offline'
            }`}
            onClick={onOpenTunnelSettings}
            title="Click to view connection diagnostics or change ngrok URL"
            aria-label="Backend connection status and tunnel configuration"
          >
            <span className="status-dot"></span>
            <span className="status-label">
              {checking ? 'Connecting...' : isOnline ? 'Backend Online' : 'Offline / Tunnel Down'}
            </span>
          </button>

          {/* Quick launch chat button in header */}
          <button
            className="header-chat-btn"
            onClick={onOpenChat}
            aria-label="Launch AI Chat Assistant"
          >
            <Activity size={16} />
            <span>Launch Chat</span>
          </button>

          {/* User profile / Role badge */}
          <div className="user-profile-badge">
            <UserCircle size={28} className="user-avatar" />
            <div className="user-meta">
              <span className="user-name">Local Admin</span>
              <span className="user-role-pill">
                <Shield size={10} />
                Administrator
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
