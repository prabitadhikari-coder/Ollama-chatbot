import React, { useState } from 'react';
import {
  X,
  Server,
  Terminal,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Zap,
} from 'lucide-react';
import {
  getApiBaseUrl,
  setCustomApiUrl,
  resetCustomApiUrl,
  checkServerStatus,
  type ServerStatus,
} from '../services/api';

interface TunnelConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: ServerStatus | null;
  onStatusUpdated: (newStatus: ServerStatus) => void;
}

export const TunnelConfigModal: React.FC<TunnelConfigModalProps> = ({
  isOpen,
  onClose,
  status,
  onStatusUpdated,
}) => {
  const [urlInput, setUrlInput] = useState<string>(getApiBaseUrl());
  const [testing, setTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);

  if (!isOpen) return null;

  const handleSaveAndTest = async () => {
    setTesting(true);
    setTestResult(null);
    setCustomApiUrl(urlInput);

    const startTime = performance.now();
    const result = await checkServerStatus();
    const elapsed = Math.round(performance.now() - startTime);

    onStatusUpdated(result);
    setTesting(false);

    if (result.connected && result.chatModelAvailable) {
      setTestResult({
        success: true,
        message: `Connected successfully to Ollama (${result.chatModel})!`,
        latencyMs: elapsed,
      });
    } else {
      setTestResult({
        success: false,
        message:
          result.error ||
          'Could not reach backend. Verify ngrok and local servers are running.',
        latencyMs: elapsed,
      });
    }
  };

  const handleResetToDefault = () => {
    resetCustomApiUrl();
    const defaultUrl = getApiBaseUrl();
    setUrlInput(defaultUrl);
    setTestResult(null);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Server size={18} />
            </div>
            <div>
              <h3 className="modal-title">Backend &amp; ngrok Tunnel Settings</h3>
              <p className="modal-subtitle">
                Configure your local Windows backend connection for Cloudflare Pages
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          {/* Active Status Banner */}
          <div
            className={`status-alert-box ${
              status?.connected && status?.chatModelAvailable ? 'success' : 'warning'
            }`}
          >
            <div className="status-alert-icon">
              {status?.connected && status?.chatModelAvailable ? (
                <CheckCircle2 size={18} className="text-emerald" />
              ) : (
                <AlertTriangle size={18} className="text-amber" />
              )}
            </div>
            <div className="status-alert-text">
              <strong>
                {status?.connected && status?.chatModelAvailable
                  ? 'Local Backend is Online & Connected'
                  : 'Backend or ngrok Tunnel is Currently Offline'}
              </strong>
              <p>{status?.error || 'Ready to process neural inferences.'}</p>
            </div>
          </div>

          {/* URL Input Form */}
          <div className="modal-field">
            <label htmlFor="tunnel-url-input">Active Backend / ngrok Gateway URL</label>
            <div className="url-input-row">
              <input
                id="tunnel-url-input"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://steadfast-luminance-praying.ngrok-free.dev"
                className="tunnel-input"
              />
              <button
                type="button"
                onClick={handleSaveAndTest}
                disabled={testing}
                className="test-connect-btn"
              >
                {testing ? (
                  <span>Pinging...</span>
                ) : (
                  <>
                    <Zap size={14} />
                    <span>Save &amp; Test</span>
                  </>
                )}
              </button>
            </div>
            <span className="field-hint">
              Saved directly to browser storage. If your free ngrok URL changes, paste the new one here.
            </span>
          </div>

          {/* Test Result Feedback */}
          {testResult && (
            <div
              className={`test-result-box ${testResult.success ? 'success' : 'error'}`}
            >
              <div className="test-result-title">
                {testResult.success ? '✓ Connection Verified' : '✕ Connection Failed'}
                {testResult.latencyMs !== undefined && (
                  <span className="latency-badge">{testResult.latencyMs} ms</span>
                )}
              </div>
              <p className="test-result-msg">{testResult.message}</p>
            </div>
          )}

          {/* Windows Startup Guidance */}
          <div className="windows-guide-box">
            <div className="guide-header">
              <Terminal size={14} />
              <span>Required Windows Terminal Setup</span>
            </div>
            <p className="guide-desc">
              Because Ollama and your server run on your physical computer, all 3 services must be active:
            </p>
            <div className="guide-steps">
              <div className="guide-step">
                <span className="step-num">1</span>
                <code>node server.js</code>
                <span className="step-desc">Starts Node server on port 3000</span>
              </div>
              <div className="guide-step">
                <span className="step-num">2</span>
                <code>python -m uvicorn gateway.main:app --host 0.0.0.0 --port 8000</code>
                <span className="step-desc">Starts FastAPI Security Gateway on port 8000</span>
              </div>
              <div className="guide-step">
                <span className="step-num">3</span>
                <code>ngrok http 8000</code>
                <span className="step-desc">Creates HTTPS tunnel to your FastAPI gateway</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="reset-btn"
            onClick={handleResetToDefault}
            title="Reset to build-time environment variable"
          >
            <RotateCcw size={13} />
            <span>Reset to Default</span>
          </button>
          <button type="button" className="close-btn" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
