// API Service for communicating with the Node.js / Ollama backend

const RAW_API_BASE = import.meta.env.VITE_API_BASE_URL || '';
// Strip trailing slash if present
export const API_BASE_URL = RAW_API_BASE.replace(/\/+$/, '');

export interface ServerStatus {
  connected: boolean;
  chatModel: string;
  readingModel: string;
  chatModelAvailable: boolean;
  readingModelAvailable: boolean;
  availableModels?: string[];
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  timestamp: string;
  error?: boolean;
}

export type ModelRole = 'chat' | 'reading';

/**
 * Standard fetch wrapper that automatically injects the ngrok bypass header
 * so that free-tier ngrok tunnels never return an HTML interstitial warning page.
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});

  // Ngrok free bypass header
  if (!headers.has('ngrok-skip-browser-warning')) {
    headers.set('ngrok-skip-browser-warning', 'true');
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Checks server health and Ollama model availability
 */
export async function checkServerStatus(signal?: AbortSignal): Promise<ServerStatus> {
  try {
    const response = await apiFetch('/api/status', {
      method: 'GET',
      signal,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        connected: false,
        chatModel: 'nemotron-mini:latest',
        readingModel: 'nemotron-3-nano:4b',
        chatModelAvailable: false,
        readingModelAvailable: false,
        error: data.error || `Server responded with status ${response.status}`,
      };
    }

    const data = await response.json();
    return data;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown connection error';
    return {
      connected: false,
      chatModel: 'nemotron-mini:latest',
      readingModel: 'nemotron-3-nano:4b',
      chatModelAvailable: false,
      readingModelAvailable: false,
      error: `Cannot reach backend (${errorMsg}). Verify server and ngrok are running.`,
    };
  }
}

export interface StreamChatParams {
  message: string;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  role: ModelRole;
  signal?: AbortSignal;
  onToken: (token: string) => void;
  onModel?: (model: string) => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

/**
 * Sends a message and consumes the Server-Sent Events (SSE) stream from the backend.
 */
export async function streamChatMessage({
  message,
  history,
  role,
  signal,
  onToken,
  onModel,
  onDone,
  onError,
}: StreamChatParams): Promise<void> {
  const response = await apiFetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      history,
      role,
    }),
    signal,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const message = errData.error || `Request failed with status ${response.status}`;
    if (onError) onError(message);
    throw new Error(message);
  }

  if (!response.body) {
    const err = 'Streaming is not supported by your browser environment.';
    if (onError) onError(err);
    throw new Error(err);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  const processLine = (lineText: string) => {
    const trimmed = lineText.trim();
    if (!trimmed.startsWith('data:')) return;

    try {
      const dataStr = trimmed.slice(5).trim();
      const data = JSON.parse(dataStr);

      if (data.error) {
        if (onError) onError(data.error);
        return;
      }
      if (data.model && onModel) {
        onModel(data.model);
      }
      if (data.token) {
        onToken(data.token);
      }
      if (data.done && onDone) {
        onDone();
      }
    } catch {
      // ignore parse errors on fragmented lines
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        const lines = event.split('\n');
        for (const line of lines) {
          processLine(line);
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      const lines = buffer.split('\n');
      for (const line of lines) {
        processLine(line);
      }
    }

    if (onDone) onDone();
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      // User aborted stream, normal exit
      return;
    }
    const errText = err instanceof Error ? err.message : 'Stream connection interrupted';
    if (onError) onError(errText);
    throw err;
  }
}
