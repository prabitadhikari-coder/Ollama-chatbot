// API Service for communicating with the Node.js / FastAPI / Ollama backend

const DEFAULT_ENV_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

/**
 * Returns active API base URL.
 * Checks localStorage first for user-configured runtime overrides (e.g. new ngrok URL),
 * falling back to the build-time VITE_API_BASE_URL, and finally empty string (same-origin).
 */
export function getApiBaseUrl(): string {
  try {
    const custom = localStorage.getItem('nexus_custom_api_url');
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, '');
    }
  } catch {
    // localStorage unavailable
  }
  return DEFAULT_ENV_URL;
}

/**
 * Saves a custom API URL override to localStorage.
 */
export function setCustomApiUrl(url: string): void {
  try {
    const trimmed = url.trim().replace(/\/+$/, '');
    if (!trimmed) {
      localStorage.removeItem('nexus_custom_api_url');
    } else {
      localStorage.setItem('nexus_custom_api_url', trimmed);
    }
  } catch {
    // ignore
  }
}

export function resetCustomApiUrl(): void {
  try {
    localStorage.removeItem('nexus_custom_api_url');
  } catch {
    // ignore
  }
}

export const API_BASE_URL = getApiBaseUrl();

export interface ServerStatus {
  connected: boolean;
  chatModel: string;
  readingModel: string;
  chatModelAvailable: boolean;
  readingModelAvailable: boolean;
  availableModels?: string[];
  error?: string;
  diagnosticDetails?: string;
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
  const base = getApiBaseUrl();
  const url = `${base}${endpoint}`;
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
 * Checks server health and Ollama model availability with detailed error diagnosis
 */
export async function checkServerStatus(signal?: AbortSignal): Promise<ServerStatus> {
  const activeUrl = getApiBaseUrl();
  try {
    const response = await apiFetch('/api/status', {
      method: 'GET',
      signal,
    });

    const isHtml = response.headers.get('content-type')?.includes('text/html');

    if (!response.ok) {
      // Check for ngrok error codes
      const ngrokErr = response.headers.get('ngrok-error-code');
      let diag = '';
      if (ngrokErr === 'ERR_NGROK_3200') {
        diag = 'ngrok Tunnel is offline (ERR_NGROK_3200). Ensure `ngrok http 8000` is running on your Windows computer.';
      } else if (response.status === 404 && isHtml) {
        diag = 'Received 404 from host. The backend URL may be misconfigured or pointing to Cloudflare Pages static root.';
      } else if (response.status === 502 || response.status === 503) {
        diag = 'Gateway cannot reach Node.js or Ollama. Ensure `npm start` and Ollama are active.';
      }

      const data = await response.json().catch(() => ({}));
      return {
        connected: false,
        chatModel: 'nemotron-mini:latest',
        readingModel: 'nemotron-3-nano:4b',
        chatModelAvailable: false,
        readingModelAvailable: false,
        error: diag || data.error || `HTTP ${response.status} from ${activeUrl || 'relative host'}`,
        diagnosticDetails: diag,
      };
    }

    if (isHtml) {
      return {
        connected: false,
        chatModel: 'nemotron-mini:latest',
        readingModel: 'nemotron-3-nano:4b',
        chatModelAvailable: false,
        readingModelAvailable: false,
        error: 'Received HTML instead of JSON. The API URL might be pointing to a web page instead of the ngrok backend.',
        diagnosticDetails: 'API Base URL is likely empty or misconfigured.',
      };
    }

    const data = await response.json();
    return data;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown network failure';
    let guidance = 'Network request failed.';
    if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
      guidance = activeUrl
        ? `Cannot connect to ${activeUrl}. Either ngrok is closed, or CORS is blocking the request.`
        : 'API base URL is not configured. On Cloudflare Pages, your ngrok URL must be set in settings.';
    }

    return {
      connected: false,
      chatModel: 'nemotron-mini:latest',
      readingModel: 'nemotron-3-nano:4b',
      chatModelAvailable: false,
      readingModelAvailable: false,
      error: guidance,
      diagnosticDetails: errorMsg,
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
      return;
    }
    const errText = err instanceof Error ? err.message : 'Stream connection interrupted';
    if (onError) onError(errText);
    throw err;
  }
}
