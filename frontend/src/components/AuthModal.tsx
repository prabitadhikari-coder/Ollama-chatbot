import React, { useState } from 'react';
import {
  X,
  Shield,
  Briefcase,
  User,
  KeyRound,
  UserPlus,
  LogIn,
  Check,
  ArrowRight
} from 'lucide-react';
import type { AuthUser, UserRole } from '../services/api';
import { setActiveAuthUser } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: AuthUser;
  onUserChanged: (user: AuthUser) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChanged,
}) => {
  const [activeTab, setActiveTab] = useState<'switch' | 'login' | 'register'>('switch');

  // Login form state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form state
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regRole, setRegRole] = useState<UserRole>('customer');
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // 1. Quick Switch Role
  const handleQuickSwitchRole = (role: UserRole) => {
    let name = 'Guest Customer';
    let username = 'customer.guest';

    if (role === 'admin') {
      name = 'Local Admin';
      username = 'admin';
    } else if (role === 'employee') {
      name = 'John Doe (Staff)';
      username = 'john.doe';
    }

    const updated: AuthUser = {
      username,
      name,
      role,
    };

    setActiveAuthUser(updated);
    onUserChanged(updated);
    onClose();
  };

  // 2. Login submit
  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const u = loginUsername.trim().toLowerCase();
    const p = loginPassword.trim();
    if (!p) {
      setLoginError('Password is required.');
      return;
    }

    // Known test enterprise accounts
    if (u === 'sarah.admin' || u === 'admin') {
      const user: AuthUser = {
        username: u,
        name: 'Sarah Connor',
        role: 'admin',
        email: 'sarah.admin@enterprise.local'
      };
      setActiveAuthUser(user);
      onUserChanged(user);
      onClose();
      return;
    }

    if (u === 'john.doe' || u === 'employee') {
      const user: AuthUser = {
        username: u,
        name: 'John Doe',
        role: 'employee',
        email: 'john.doe@enterprise.local'
      };
      setActiveAuthUser(user);
      onUserChanged(user);
      onClose();
      return;
    }

    if (u.includes('admin')) {
      const user: AuthUser = {
        username: u,
        name: loginUsername.trim(),
        role: 'admin',
      };
      setActiveAuthUser(user);
      onUserChanged(user);
      onClose();
      return;
    }

    if (u.includes('employee') || u.includes('staff')) {
      const user: AuthUser = {
        username: u,
        name: loginUsername.trim(),
        role: 'employee',
      };
      setActiveAuthUser(user);
      onUserChanged(user);
      onClose();
      return;
    }

    // Default to customer role
    const user: AuthUser = {
      username: u || 'guest',
      name: loginUsername.trim() || 'Verified Customer',
      role: 'customer',
    };
    setActiveAuthUser(user);
    onUserChanged(user);
    onClose();
  };

  // 3. Register submit
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUsername.trim()) return;

    const user: AuthUser = {
      username: regUsername.trim().toLowerCase(),
      name: regName.trim() || regUsername.trim(),
      role: regRole,
    };

    setActiveAuthUser(user);
    onUserChanged(user);
    setRegSuccess(`Account created as ${regRole.toUpperCase()}!`);
    setTimeout(() => {
      onClose();
    }, 600);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '16px'
    }}>
      <div
        className="modal-window"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '520px',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Shield size={20} style={{ color: '#38bdf8' }} />
              Role &amp; Identity Management
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#94a3b8' }}>
              Current User: <strong style={{ color: '#ffffff' }}>{currentUser.name}</strong> ({currentUser.role.toUpperCase()})
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('switch')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              background: activeTab === 'switch' ? '#ffffff' : 'transparent',
              borderBottom: activeTab === 'switch' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'switch' ? '#2563eb' : '#64748b',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <KeyRound size={16} />
            Switch Role
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              background: activeTab === 'login' ? '#ffffff' : 'transparent',
              borderBottom: activeTab === 'login' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'login' ? '#2563eb' : '#64748b',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <LogIn size={16} />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            style={{
              flex: 1,
              padding: '12px 16px',
              border: 'none',
              background: activeTab === 'register' ? '#ffffff' : 'transparent',
              borderBottom: activeTab === 'register' ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === 'register' ? '#2563eb' : '#64748b',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <UserPlus size={16} />
            Register
          </button>
        </div>

        {/* Tab Body */}
        <div style={{ padding: '24px' }}>
          {/* TAB 1: QUICK ROLE SWITCH */}
          {activeTab === 'switch' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ margin: '0 0 8px', fontSize: '13px', color: '#64748b' }}>
                Select an operational role to instantly test database clearance and permissions:
              </p>

              {/* Admin Card */}
              <div
                onClick={() => handleQuickSwitchRole('admin')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: currentUser.role === 'admin' ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                  background: currentUser.role === 'admin' ? '#faf5ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#f3e8ff',
                  color: '#7c3aed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Shield size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '15px', color: '#0f172a' }}>Administrator (Executive)</strong>
                    {currentUser.role === 'admin' && (
                      <span style={{ fontSize: '11px', background: '#7c3aed', color: '#fff', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>Active</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Full Access: SAP POs ($), Staff Claims, Customer Orders &amp; Emails, Live Catalog
                  </div>
                </div>
                <ArrowRight size={18} style={{ color: '#94a3b8' }} />
              </div>

              {/* Employee Card */}
              <div
                onClick={() => handleQuickSwitchRole('employee')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: currentUser.role === 'employee' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                  background: currentUser.role === 'employee' ? '#eff6ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#dbeafe',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Briefcase size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '15px', color: '#0f172a' }}>Enterprise Staff (Employee)</strong>
                    {currentUser.role === 'employee' && (
                      <span style={{ fontSize: '11px', background: '#2563eb', color: '#fff', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>Active</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Staff Access: Customer Orders &amp; Emails, Expense Claims, Office Wi-Fi, Stock
                  </div>
                </div>
                <ArrowRight size={18} style={{ color: '#94a3b8' }} />
              </div>

              {/* Customer Card */}
              <div
                onClick={() => handleQuickSwitchRole('customer')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: currentUser.role === 'customer' ? '2px solid #059669' : '1px solid #e2e8f0',
                  background: currentUser.role === 'customer' ? '#ecfdf5' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: '#d1fae5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <User size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <strong style={{ fontSize: '15px', color: '#0f172a' }}>Public Customer (Storefront)</strong>
                    {currentUser.role === 'customer' && (
                      <span style={{ fontSize: '11px', background: '#059669', color: '#fff', padding: '2px 8px', borderRadius: '999px', fontWeight: 600 }}>Active</span>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    Shielded Access: Real-time Catalog &amp; Live Stock only (Orders &amp; claims blocked)
                  </div>
                </div>
                <ArrowRight size={18} style={{ color: '#94a3b8' }} />
              </div>
            </div>
          )}

          {/* TAB 2: SIGN IN FORM */}
          {activeTab === 'login' && (
            <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {loginError && (
                <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', fontSize: '13px' }}>
                  {loginError}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Username or Email
                </label>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="e.g. sarah.admin or john.doe"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Quick Demo Credentials */}
              <div style={{ padding: '10px 12px', background: '#f1f5f9', borderRadius: '8px', fontSize: '12px' }}>
                <span style={{ color: '#64748b', fontWeight: 600 }}>Quick Fill Demo Accounts:</span>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => { setLoginUsername('sarah.admin'); setLoginPassword('adminpass123'); }}
                    style={{ padding: '4px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: '#7c3aed' }}
                  >
                    Admin: sarah.admin
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLoginUsername('john.doe'); setLoginPassword('password123'); }}
                    style={{ padding: '4px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: '#2563eb' }}
                  >
                    Staff: john.doe
                  </button>
                  <button
                    type="button"
                    onClick={() => { setLoginUsername('customer.guest'); setLoginPassword('guest123'); }}
                    style={{ padding: '4px 10px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: '#059669' }}
                  >
                    Customer: customer.guest
                  </button>
                </div>
              </div>

              <button
                type="submit"
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#2563eb',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <LogIn size={16} />
                Sign In to Enterprise Workspace
              </button>
            </form>
          )}

          {/* TAB 3: REGISTER FORM */}
          {activeTab === 'register' && (
            <form onSubmit={handleRegisterSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {regSuccess && (
                <div style={{ padding: '10px 14px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={16} /> {regSuccess}
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Full Name
                </label>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="e.g. Alex Rivera"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Username
                </label>
                <input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="e.g. alex.rivera"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Assigned Security Role
                </label>
                <select
                  value={regRole}
                  onChange={(e) => setRegRole(e.target.value as UserRole)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    background: '#ffffff',
                    fontWeight: 600,
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="customer">👤 Customer (Public Storefront)</option>
                  <option value="employee">💼 Employee (Staff Operations)</option>
                  <option value="admin">🔑 Administrator (Full Access)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Password
                </label>
                <input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '14px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: '#059669',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: 'pointer',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <UserPlus size={16} />
                Create Account &amp; Activate Role
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
