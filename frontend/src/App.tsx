import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { ServerStatus, ChatMessage, ModelRole } from './services/api';
import { checkServerStatus, streamChatMessage } from './services/api';
import { Header } from './components/Header';
import { MainLayout } from './components/MainLayout';
import { FloatingChatButton } from './components/FloatingChatButton';
import { ChatWindow } from './components/ChatWindow';
import { TunnelConfigModal } from './components/TunnelConfigModal';

export const App: React.FC = () => {
  // Navigation & UI state
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isChatMinimized, setIsChatMinimized] = useState<boolean>(false);
  const [isTunnelModalOpen, setIsTunnelModalOpen] = useState<boolean>(false);

  // Server & Model Status
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(true);
  const [modelRole, setModelRole] = useState<ModelRole>('chat');

  // Conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [lastUserMessage, setLastUserMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  // Active abort controller for current generation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch status on mount and poll periodically
  const fetchStatus = useCallback(async () => {
    setCheckingStatus(true);
    const result = await checkServerStatus();
    setServerStatus(result);
    setCheckingStatus(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // Reset unread count when chat is opened
  useEffect(() => {
    if (isChatOpen && !isChatMinimized) {
      setUnreadCount(0);
    }
  }, [isChatOpen, isChatMinimized]);

  // Current active model display name
  const activeModelName =
    modelRole === 'reading'
      ? serverStatus?.readingModel || 'nemotron-3-nano:4b'
      : serverStatus?.chatModel || 'nemotron-mini:latest';

  const formatTimestamp = () => {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Stop response generation
  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  }, []);

  // Send message
  const handleSendMessage = useCallback(
    async (textToSend?: string, overrideRole?: ModelRole) => {
      const text = (textToSend || input).trim();
      if (!text || isGenerating) return;

      const currentRole = overrideRole || modelRole;
      if (overrideRole) {
        setModelRole(overrideRole);
      }

      setError(null);
      setLastUserMessage(text);
      if (!textToSend) {
        setInput('');
      }

      const userMsgId = `user-${Date.now()}`;
      const userMessage: ChatMessage = {
        id: userMsgId,
        role: 'user',
        content: text,
        timestamp: formatTimestamp(),
      };

      const assistantMsgId = `assistant-${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        model: activeModelName,
        timestamp: formatTimestamp(),
      };

      const newHistory = [...messages, userMessage];
      setMessages([...newHistory, assistantMessage]);
      setIsGenerating(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Extract history formatted for backend API
      const apiHistory = messages
        .filter((m) => !m.error && m.content)
        .slice(-20)
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));

      try {
        await streamChatMessage({
          message: text,
          history: apiHistory,
          role: currentRole,
          signal: controller.signal,
          onToken: (token: string) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? { ...msg, content: msg.content + token }
                  : msg
              )
            );
          },
          onModel: (model: string) => {
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId ? { ...msg, model } : msg
              )
            );
          },
          onDone: () => {
            setIsGenerating(false);
            abortControllerRef.current = null;
            if (!isChatOpen || isChatMinimized) {
              setUnreadCount((c) => c + 1);
            }
          },
          onError: (errMsg: string) => {
            setError(errMsg);
            setIsGenerating(false);
            abortControllerRef.current = null;
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === assistantMsgId
                  ? {
                      ...msg,
                      error: true,
                      content:
                        msg.content ||
                        `An error occurred: ${errMsg}. Check Ollama and ngrok status.`,
                    }
                  : msg
              )
            );
          },
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Normal client cancellation
          return;
        }
        const errorText =
          err instanceof Error ? err.message : 'Connection to server interrupted';
        setError(errorText);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMsgId
              ? {
                  ...msg,
                  error: true,
                  content:
                    msg.content ||
                    `Connection failed: ${errorText}. Please verify the server is running.`,
                }
              : msg
          )
        );
      } finally {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    },
    [
      input,
      isGenerating,
      modelRole,
      activeModelName,
      messages,
      isChatOpen,
      isChatMinimized,
    ]
  );

  // New conversation
  const handleNewChat = () => {
    if (isGenerating) {
      handleStop();
    }
    setMessages([]);
    setError(null);
    setLastUserMessage(null);
  };

  // Retry last prompt
  const handleRetry = () => {
    if (lastUserMessage) {
      // Remove last failed assistant bubble and retry
      setMessages((prev) =>
        prev.filter((m) => !(m.role === 'assistant' && m.error))
      );
      handleSendMessage(lastUserMessage);
    }
  };

  // Open chat and prefill or execute prompt
  const handleOpenChatWithPrompt = (prompt: string, role?: ModelRole) => {
    setIsChatOpen(true);
    setIsChatMinimized(false);
    if (role) {
      setModelRole(role);
    }
    handleSendMessage(prompt, role);
  };

  return (
    <div className="app-root">
      {/* Top Application Navigation & Header */}
      <Header
        status={serverStatus}
        checking={checkingStatus}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenChat={() => {
          setIsChatOpen(true);
          setIsChatMinimized(false);
        }}
        onOpenTunnelSettings={() => setIsTunnelModalOpen(true)}
      />

      {/* Main Content Viewport */}
      <MainLayout
        status={serverStatus}
        checking={checkingStatus}
        activeTab={activeTab}
        onOpenChatWithPrompt={handleOpenChatWithPrompt}
        onOpenChat={() => {
          setIsChatOpen(true);
          setIsChatMinimized(false);
        }}
        onRefreshStatus={fetchStatus}
      />

      {/* Floating Action Button */}
      <FloatingChatButton
        isOpen={isChatOpen}
        isMinimized={isChatMinimized}
        onToggle={() => {
          if (!isChatOpen) {
            setIsChatOpen(true);
            setIsChatMinimized(false);
          } else if (isChatMinimized) {
            setIsChatMinimized(false);
          } else {
            setIsChatOpen(false);
          }
        }}
        unreadCount={unreadCount}
        isOnline={Boolean(serverStatus?.connected && serverStatus?.chatModelAvailable)}
      />

      {/* Floating Expandable Chat Window */}
      <ChatWindow
        isOpen={isChatOpen}
        isMinimized={isChatMinimized}
        onToggleMinimize={() => setIsChatMinimized((prev) => !prev)}
        onClose={() => setIsChatOpen(false)}
        messages={messages}
        isGenerating={isGenerating}
        input={input}
        setInput={setInput}
        onSend={() => handleSendMessage()}
        onStop={handleStop}
        onNewChat={handleNewChat}
        status={serverStatus}
        checkingStatus={checkingStatus}
        onRefreshStatus={fetchStatus}
        role={modelRole}
        onRoleChange={setModelRole}
        error={error}
        onRetry={lastUserMessage ? handleRetry : undefined}
        onDismissError={() => setError(null)}
        onSelectPrompt={(p, r) => handleSendMessage(p, r)}
        activeModelName={activeModelName}
      />

      {/* Backend & ngrok Tunnel Configuration Modal */}
      <TunnelConfigModal
        isOpen={isTunnelModalOpen}
        onClose={() => setIsTunnelModalOpen(false)}
        status={serverStatus}
        onStatusUpdated={(newStatus) => setServerStatus(newStatus)}
      />
    </div>
  );
};

export default App;
