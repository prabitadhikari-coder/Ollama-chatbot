import React from 'react';
import { Cpu } from 'lucide-react';

interface TypingIndicatorProps {
  modelName: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ modelName }) => {
  return (
    <div className="typing-indicator-row" aria-live="polite">
      <div className="typing-bubble">
        <div className="typing-dots">
          <span className="dot dot-1"></span>
          <span className="dot dot-2"></span>
          <span className="dot dot-3"></span>
        </div>
        <div className="typing-label">
          <Cpu size={12} />
          <span>Generating with {modelName}...</span>
        </div>
      </div>
    </div>
  );
};
