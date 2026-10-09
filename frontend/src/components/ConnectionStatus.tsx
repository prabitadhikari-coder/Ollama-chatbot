import React from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';
import type { ServerStatus } from '../services/api';

interface ConnectionStatusProps {
  status: ServerStatus | null;
  checking: boolean;
  onRefresh: () => void;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  status,
  checking,
  onRefresh,
}) => {
  const isConnected = Boolean(status?.connected);
  const isChatReady = Boolean(status?.chatModelAvailable);

  return (
    <div className="connection-status-pill">
      {checking ? (
        <>
          <RefreshCw size={12} className="spin-icon" />
          <span>Verifying Ollama...</span>
        </>
      ) : isConnected && isChatReady ? (
        <>
          <Wifi size={12} className="text-emerald" />
          <span>Ollama Connected</span>
        </>
      ) : isConnected && !isChatReady ? (
        <>
          <WifiOff size={12} className="text-amber" />
          <span>Chat model not found</span>
        </>
      ) : (
        <>
          <WifiOff size={12} className="text-rose" />
          <span>Backend Unavailable</span>
          <button
            onClick={onRefresh}
            className="refresh-btn"
            title="Retry connecting to backend"
          >
            Retry
          </button>
        </>
      )}
    </div>
  );
};
