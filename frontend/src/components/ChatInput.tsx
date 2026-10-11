import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Send, Square, Mic, MicOff, Database } from 'lucide-react';

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  isGenerating: boolean;
  disabled: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  input,
  setInput,
  onSend,
  onStop,
  isGenerating,
  disabled,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isListening, setIsListening] = useState<boolean>(false);
  const recognitionRef = useRef<any>(null);

  // Auto-resize textarea to fit content
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.min(scrollHeight, 140)}px`;
    }
  }, [input]);

  // Speech Recognition setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setInput(input ? `${input.trim()} ${transcript}` : transcript);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [input, setInput]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  }, [isListening]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && !disabled && input.trim()) {
        if (isListening && recognitionRef.current) {
          recognitionRef.current.stop();
          setIsListening(false);
        }
        onSend();
      }
    }
  };

  return (
    <form
      className="chat-input-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (isGenerating) {
          onStop();
        } else if (!disabled && input.trim()) {
          if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            setIsListening(false);
          }
          onSend();
        }
      }}
    >
      <div className={`input-field-wrapper ${isListening ? 'listening-active' : ''}`}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isListening
              ? 'Listening to your voice... Speak now.'
              : disabled
              ? 'Backend offline. Check Ollama and ngrok tunnel...'
              : 'Ask questions, query database records, or request summaries...'
          }
          disabled={disabled && !isGenerating}
          rows={1}
          className="chat-textarea"
          aria-label="Chat input prompt"
        />

        <div className="input-action-buttons">
          {/* Voice dictation button */}
          {typeof window !== 'undefined' &&
            ((window as any).SpeechRecognition ||
              (window as any).webkitSpeechRecognition) && (
              <button
                type="button"
                onClick={toggleListening}
                className={`voice-mic-btn ${isListening ? 'active-recording' : ''}`}
                title={isListening ? 'Stop listening' : 'Dictate prompt with microphone'}
                aria-label={isListening ? 'Stop voice recording' : 'Start voice recording'}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}

          {isGenerating ? (
            <button
              type="button"
              onClick={onStop}
              className="stop-generation-btn"
              title="Stop response generation"
              aria-label="Stop response generation"
            >
              <Square size={14} className="fill-current" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={disabled || !input.trim()}
              className="send-message-btn"
              title="Send message"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="input-subtext">
        <div className="subtext-left">
          <Database size={11} className="text-emerald" />
          <span>Knowledge &amp; SQL Engine Ready</span>
        </div>
        <div className="subtext-right">
          <span>Shift + Enter for new line</span>
        </div>
      </div>
    </form>
  );
};
