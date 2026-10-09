import React from 'react';
import { AlertTriangle, RefreshCw, X } from 'lucide-react';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  onRetry,
  onDismiss,
}) => {
  return (
    <div className="error-banner" role="alert">
      <div className="error-icon-col">
        <AlertTriangle size={18} className="error-icon" />
      </div>
      <div className="error-content">
        <p className="error-text">{message}</p>
        {onRetry && (
          <button
            className="error-retry-btn"
            onClick={onRetry}
            type="button"
          >
            <RefreshCw size={12} />
            <span>Try Again</span>
          </button>
        )}
      </div>
      {onDismiss && (
        <button
          className="error-dismiss-btn"
          onClick={onDismiss}
          aria-label="Dismiss error notification"
          type="button"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};
