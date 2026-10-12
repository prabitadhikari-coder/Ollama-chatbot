import React from 'react';
import { Bot, Shield, Activity, UserCircle, Briefcase, User } from 'lucide-react';
import type { ServerStatus, AuthUser } from '../services/api';

interface HeaderProps {
  status: ServerStatus | null;
  checking: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenChat: () => void;
  onOpenTunnelSettings: () => void;
  currentUser: AuthUser;
  onOpenAuthModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  checking,
  activeTab,
  setActiveTab,
  onOpenChat,
  onOpenTunnelSettings,
  currentUser,
  onOpenAuthModal,
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
            className={`nav-tab ${activeTab === 'db-hub' ? 'active' : ''}`}
            onClick={() => setActiveTab('db-hub')}
          >
            Database Hub
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

          {/* User profile / Role badge with interactive Role Changing & Login trigger */}
          <button
            type="button"
            className="user-profile-badge user-profile-btn"
            onClick={onOpenAuthModal}
            title="Click to Switch Role, Sign In, or Register"
            aria-label="User profile, role management, and authentication"
            style={{
              cursor: 'pointer',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '6px 12px',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              transition: 'all 0.2s ease',
            }}
          >
            <UserCircle
              size={28}
              className="user-avatar"
              style={{
                color:
                  currentUser.role === 'admin'
                    ? '#7c3aed'
                    : currentUser.role === 'employee'
                    ? '#2563eb'
                    : '#059669',
              }}
            />
            <div className="user-meta" style={{ textAlign: 'left' }}>
              <span className="user-name" style={{ fontWeight: 600, fontSize: '13px', color: '#0f172a' }}>
                {currentUser.name}
              </span>
              <span
                className="user-role-pill"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: '999px',
                  padding: '2px 8px',
                  background:
                    currentUser.role === 'admin'
                      ? '#f3e8ff'
                      : currentUser.role === 'employee'
                      ? '#eff6ff'
                      : '#ecfdf5',
                  color:
                    currentUser.role === 'admin'
                      ? '#7c3aed'
                      : currentUser.role === 'employee'
                      ? '#2563eb'
                      : '#059669',
                }}
              >
                {currentUser.role === 'admin' ? (
                  <>
                    <Shield size={10} /> Administrator
                  </>
                ) : currentUser.role === 'employee' ? (
                  <>
                    <Briefcase size={10} /> Staff Employee
                  </>
                ) : (
                  <>
                    <User size={10} /> Customer
                  </>
                )}
              </span>
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#64748b',
                background: '#f1f5f9',
                padding: '4px 6px',
                borderRadius: '6px',
                fontWeight: 600,
                marginLeft: '4px',
              }}
            >
              Switch
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
