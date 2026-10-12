/**
 * NexusAI Universal Embeddable Chatbot Widget
 * Works on ANY website (WordPress, Shopify, Webflow, React, HTML, etc.)
 * 
 * Usage:
 * <script 
 *   src="https://your-server-or-ngrok.com/widget.js" 
 *   data-api-url="https://your-server-or-ngrok.com" 
 *   data-title="NexusAI Assistant"
 *   data-role="chat"
 *   defer>
 * </script>
 */

(function () {
  'use strict';

  // Prevent multiple initializations
  if (window.__NEXUS_AI_WIDGET_LOADED__) return;
  window.__NEXUS_AI_WIDGET_LOADED__ = true;

  // Determine configuration from current script tag
  const currentScript =
    document.currentScript ||
    document.querySelector('script[src*="widget.js"]');

  const config = {
    apiUrl: (
      currentScript?.getAttribute('data-api-url') ||
      (currentScript?.src ? new URL(currentScript.src).origin : '') ||
      window.location.origin
    ).replace(/\/+$/, ''),
    title: currentScript?.getAttribute('data-title') || 'NexusAI Assistant',
    subtitle: currentScript?.getAttribute('data-subtitle') || 'Powered by Local Ollama',
    role: currentScript?.getAttribute('data-role') || 'chat',
    userRole: currentScript?.getAttribute('data-user-role') || window.NEXUS_USER_ROLE || (typeof localStorage !== 'undefined' ? localStorage.getItem('nexus_user_role') : null) || 'admin',
    primaryColor: currentScript?.getAttribute('data-color') || '#2563eb',
    position: currentScript?.getAttribute('data-position') || 'bottom-right',
  };

  // State
  let isOpen = false;
  let isGenerating = false;
  let currentAbortController = null;
  const messages = [];

  // Create isolated container with Shadow DOM to prevent CSS conflicts with host site
  const host = document.createElement('div');
  host.id = 'nexus-ai-widget-host';
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  // Styles
  const style = document.createElement('style');
  style.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    }

    .widget-container {
      position: fixed;
      z-index: 2147483647;
      ${config.position === 'bottom-left' ? 'left: 24px;' : 'right: 24px;'}
      bottom: 24px;
      display: flex;
      flex-direction: column;
      align-items: ${config.position === 'bottom-left' ? 'flex-start' : 'flex-end'};
    }

    /* Floating Toggle Button */
    .chat-bubble-btn {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: linear-gradient(135deg, ${config.primaryColor}, #1d4ed8);
      color: #ffffff;
      border: none;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(37, 99, 235, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
      position: relative;
    }

    .chat-bubble-btn:hover {
      transform: scale(1.06);
      box-shadow: 0 12px 28px rgba(37, 99, 235, 0.5);
    }

    .chat-bubble-btn svg {
      width: 28px;
      height: 28px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .online-indicator {
      position: absolute;
      top: 2px;
      right: 2px;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #10b981;
      border: 2px solid #0f172a;
    }

    /* Chat Window */
    .chat-window {
      position: fixed;
      ${config.position === 'bottom-left' ? 'left: 24px;' : 'right: 24px;'}
      bottom: 96px;
      width: 380px;
      height: 560px;
      max-width: calc(100vw - 32px);
      max-height: calc(100vh - 120px);
      background: #0f172a;
      color: #f8fafc;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 20px 48px rgba(0, 0, 0, 0.5), 0 0 1px rgba(255, 255, 255, 0.2);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      transform: translateY(20px) scale(0.96);
      pointer-events: none;
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .chat-window.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      pointer-events: all;
    }

    /* Header */
    .chat-header {
      padding: 16px 18px;
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .header-avatar {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: rgba(37, 99, 235, 0.2);
      border: 1px solid rgba(37, 99, 235, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #60a5fa;
    }

    .header-avatar svg {
      width: 20px;
      height: 20px;
      stroke: currentColor;
      stroke-width: 2;
    }

    .header-text h4 {
      font-size: 15px;
      font-weight: 600;
      color: #f1f5f9;
    }

    .header-text p {
      font-size: 12px;
      color: #94a3b8;
    }

    .close-btn {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 6px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .close-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #f8fafc;
    }

    /* Messages List */
    .messages-area {
      flex: 1;
      overflow-y: auto;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .welcome-card {
      background: rgba(30, 41, 59, 0.4);
      border: 1px dashed rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      padding: 16px;
      text-align: center;
      font-size: 13px;
      color: #94a3b8;
      line-height: 1.5;
    }

    .msg-bubble {
      max-width: 85%;
      padding: 11px 15px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.5;
      word-break: break-word;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .msg-bubble.user {
      align-self: flex-end;
      background: linear-gradient(135deg, ${config.primaryColor}, #1d4ed8);
      color: #ffffff;
      border-bottom-right-radius: 4px;
    }

    .msg-bubble.assistant {
      align-self: flex-start;
      background: #1e293b;
      color: #e2e8f0;
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-bottom-left-radius: 4px;
      white-space: pre-wrap;
    }

    .typing-cursor {
      display: inline-block;
      width: 6px;
      height: 14px;
      background: #60a5fa;
      margin-left: 4px;
      vertical-align: middle;
      animation: blink 0.8s infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0; }
    }

    /* Input Footer */
    .chat-footer {
      padding: 12px 14px;
      background: rgba(15, 23, 42, 0.9);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .chat-input {
      flex: 1;
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 14px;
      color: #f8fafc;
      outline: none;
      transition: border-color 0.2s;
    }

    .chat-input:focus {
      border-color: ${config.primaryColor};
    }

    .chat-input::placeholder {
      color: #64748b;
    }

    .send-btn {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: ${config.primaryColor};
      color: #ffffff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .send-btn:hover {
      background: #1d4ed8;
    }

    .send-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .send-btn svg {
      width: 18px;
      height: 18px;
      stroke: currentColor;
      stroke-width: 2;
    }
  `;

  // Markup
  const wrapper = document.createElement('div');
  wrapper.className = 'widget-container';
  wrapper.innerHTML = `
    <!-- Chat Window -->
    <div class="chat-window" id="widget-window">
      <div class="chat-header">
        <div class="header-info">
          <div class="header-avatar">
            <svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/><path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/><path d="m8 22 4-10 4 10"/></svg>
          </div>
          <div class="header-text">
            <h4>${config.title}</h4>
            <p>${config.subtitle}</p>
          </div>
        </div>
        <button class="close-btn" id="widget-close" aria-label="Close Chat">
          <svg viewBox="0 0 24 24" width="18" height="18"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>

      <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 14px; background:#f8fafc; border-bottom:1px solid #e2e8f0; font-size:12px;">
        <span style="font-weight:600; color:#475569;">Access Level:</span>
        <select id="widget-role-select" style="padding:2px 8px; font-size:11px; border-radius:6px; border:1px solid #cbd5e1; background:#fff; font-weight:600; cursor:pointer;">
          <option value="admin" ${config.userRole === 'admin' ? 'selected' : ''}>🔑 Admin (Full Access)</option>
          <option value="employee" ${config.userRole === 'employee' ? 'selected' : ''}>💼 Employee (Staff)</option>
          <option value="customer" ${config.userRole === 'customer' ? 'selected' : ''}>👤 Customer (Public)</option>
        </select>
      </div>

      <div class="messages-area" id="widget-messages">
        <div class="welcome-card">
          👋 <strong>Hello! How can I help you today?</strong><br />
          Ask any question to interact with our local neural intelligence model.
        </div>
      </div>

      <form class="chat-footer" id="widget-form">
        <input 
          type="text" 
          id="widget-input" 
          class="chat-input" 
          placeholder="Type your message..." 
          autocomplete="off"
        />
        <button type="submit" id="widget-send" class="send-btn" aria-label="Send">
          <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </form>
    </div>

    <!-- Floating Toggle Button -->
    <button class="chat-bubble-btn" id="widget-toggle" aria-label="Open Chat">
      <div class="online-indicator"></div>
      <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
    </button>
  `;

  shadow.appendChild(style);
  shadow.appendChild(wrapper);

  // Element handles
  const windowEl = shadow.getElementById('widget-window');
  const toggleBtn = shadow.getElementById('widget-toggle');
  const closeBtn = shadow.getElementById('widget-close');
  const messagesEl = shadow.getElementById('widget-messages');
  const formEl = shadow.getElementById('widget-form');
  const inputEl = shadow.getElementById('widget-input');
  const sendBtn = shadow.getElementById('widget-send');
  const roleSelectEl = shadow.getElementById('widget-role-select');

  if (roleSelectEl) {
    roleSelectEl.addEventListener('change', (e) => {
      config.userRole = e.target.value;
      try { localStorage.setItem('nexus_user_role', e.target.value); } catch {}
    });
  }

  // Toggle Chat
  function setOpen(state) {
    isOpen = state;
    if (isOpen) {
      windowEl.classList.add('open');
      inputEl.focus();
    } else {
      windowEl.classList.remove('open');
    }
  }

  toggleBtn.addEventListener('click', () => setOpen(!isOpen));
  closeBtn.addEventListener('click', () => setOpen(false));

  // Add Message to DOM
  function appendMessage(role, text) {
    const bubble = document.createElement('div');
    bubble.className = `msg-bubble ${role}`;
    bubble.textContent = text;
    messagesEl.appendChild(bubble);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  // Send message to backend
  async function sendMessage(text) {
    if (!text || isGenerating) return;

    isGenerating = true;
    sendBtn.disabled = true;

    // User message
    appendMessage('user', text);
    messages.push({ role: 'user', content: text });

    // Assistant placeholder
    const assistantBubble = appendMessage('assistant', '');
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    assistantBubble.appendChild(cursor);

    currentAbortController = new AbortController();

    try {
      const activeRole = config.userRole || (roleSelectEl ? roleSelectEl.value : 'admin');
      const response = await fetch(`${config.apiUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          'X-User-Role': activeRole,
        },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-10),
          role: config.role,
          userRole: activeRole,
        }),
        signal: currentAbortController.signal,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let assistantText = '';
      let buffer = '';

      cursor.remove();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data:')) {
            try {
              const data = JSON.parse(trimmed.slice(5).trim());
              if (data.token) {
                assistantText += data.token;
                assistantBubble.textContent = assistantText;
                messagesEl.scrollTop = messagesEl.scrollHeight;
              }
            } catch {}
          }
        }
      }

      messages.push({ role: 'assistant', content: assistantText });
    } catch (err) {
      cursor.remove();
      if (err.name !== 'AbortError') {
        assistantBubble.textContent = `Error: ${err.message}. Please verify the AI backend connection.`;
        assistantBubble.style.color = '#f87171';
      }
    } finally {
      isGenerating = false;
      sendBtn.disabled = false;
      currentAbortController = null;
      inputEl.focus();
    }
  }

  // Handle Form Submit
  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    sendMessage(text);
  });
})();
