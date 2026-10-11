require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.PORT || 3000;

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const CHAT_MODEL = process.env.CHAT_MODEL || "nemotron-mini:latest";
const READING_MODEL = process.env.READING_MODEL || "nemotron-3-nano:4b";

const SYSTEM_PROMPT = `
You are a careful and factual AI assistant.

- Never invent facts, sources, statistics, or technical details.
- If you do not know an answer, say "I don't know."
- If you lack sufficient information, say so clearly.
- Never present guesses as verified facts.
- Ask for clarification when necessary.
- Be concise, helpful, and honest.
- Never claim to have performed an action you did not perform.
`;

// Security: basic response headers
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// Parse allowed CORS origins from env
const rawAllowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:8000",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:8000",
  "https://steadfast-luminance-praying.ngrok-free.dev"
];

const allAllowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...rawAllowedOrigins]));

function isOriginAllowed(origin) {
  // Allow curl, mobile apps, or same-origin requests where origin header is undefined
  if (!origin) return true;
  if (allAllowedOrigins.includes(origin)) return true;

  try {
    const url = new URL(origin);
    // Allow any localhost / loopback port (3000, 5173, 8000, etc.)
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1") return true;
    // Automatically allow any Cloudflare Pages domain (*.pages.dev)
    if (url.hostname.endsWith(".pages.dev")) return true;
    // Allow ngrok tunnels
    if (url.hostname.endsWith(".ngrok-free.dev") || url.hostname.endsWith(".ngrok.app")) return true;
  } catch {
    return false;
  }
  return false;
}

// CORS configuration
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        console.warn(`[CORS Blocked] Origin: ${origin}`);
        callback(new Error(`CORS policy: Origin ${origin} is not allowed`));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "ngrok-skip-browser-warning",
      "X-Requested-With",
      "Accept"
    ]
  })
);

// Rate limiting to protect local host from resource exhaustion / DoS
const globalLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many requests to the server. Please wait a moment and try again."
  }
});

const chatLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "AI model rate limit exceeded. Please wait a few seconds before sending another message."
  }
});

app.use("/api/", globalLimiter);

// Request body size limit
app.use(express.json({ limit: "100kb" }));

// Static frontend serving: checks root dist, frontend/dist, and public
const distPaths = [
  path.join(__dirname, "dist"),
  path.join(__dirname, "frontend", "dist"),
  path.join(__dirname, "public")
];

for (const dirPath of distPaths) {
  if (fs.existsSync(dirPath)) {
    app.use(
      express.static(dirPath, {
        setHeaders: (res, filePath) => {
          if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
            res.setHeader("Content-Type", "text/javascript; charset=utf-8");
          } else if (filePath.endsWith(".css")) {
            res.setHeader("Content-Type", "text/css; charset=utf-8");
          }
        }
      })
    );
  }
}

// Lightweight health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Ollama and models status endpoint
app.get("/api/status", async (req, res) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error("Ollama returned non-200 status");

    const data = await response.json();
    const models = (data.models || []).map((m) => m.name);

    res.json({
      connected: true,
      chatModel: CHAT_MODEL,
      readingModel: READING_MODEL,
      chatModelAvailable: models.includes(CHAT_MODEL),
      readingModelAvailable: models.includes(READING_MODEL),
      availableModels: models
    });
  } catch (err) {
    res.status(503).json({
      connected: false,
      chatModel: CHAT_MODEL,
      readingModel: READING_MODEL,
      chatModelAvailable: false,
      readingModelAvailable: false,
      error: "Cannot connect to Ollama. Check that Ollama service is running on the host machine."
    });
  }
});

// AI Chat endpoint with streaming SSE and request cancellation
app.post("/api/chat", chatLimiter, async (req, res) => {
  const clientAbortController = new AbortController();

  // Cancel upstream Ollama request when client disconnects or aborts
  req.on("close", () => {
    if (!res.writableEnded) {
      clientAbortController.abort();
    }
  });

  try {
    const { message, history = [], role = "chat" } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Please enter a message." });
    }

    if (message.length > 10000) {
      return res.status(413).json({ error: "Message is too long. Limit is 10,000 characters." });
    }

    if (!Array.isArray(history) || history.length > 40) {
      return res.status(400).json({
        error: "Invalid conversation history. Must be an array of at most 40 messages."
      });
    }

    const validRoles = ["chat", "reading"];
    const sanitizedRole = validRoles.includes(role) ? role : "chat";
    const model = sanitizedRole === "reading" ? READING_MODEL : CHAT_MODEL;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history
        .filter(
          (m) =>
            m &&
            ["user", "assistant"].includes(m.role) &&
            typeof m.content === "string"
        )
        .slice(-40)
        .map((m) => ({
          role: m.role,
          content: m.content
        })),
      { role: "user", content: message.trim() }
    ];

    const timeoutId = setTimeout(() => clientAbortController.abort(), 120000);

    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        keep_alive: "10m",
        options: {
          temperature: 0.2,
          num_ctx: 4096,
          num_predict: 512
        }
      }),
      signal: clientAbortController.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const details = await response.text();
      console.error("[Ollama Error]", details);

      return res.status(502).json({
        error: "Ollama could not process the request. Check that the specified model is installed and running."
      });
    }

    // Set Server-Sent Events headers
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    function sendEvent(data) {
      if (!res.destroyed && !res.writableEnded) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      }
    }

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const chunk = JSON.parse(line);
          sendEvent({
            token: chunk.message?.content || "",
            model: chunk.model || model,
            done: Boolean(chunk.done)
          });
        } catch {
          // ignore malformed partial lines
        }
      }
    }

    buffer += decoder.decode();
    if (buffer.trim()) {
      try {
        const chunk = JSON.parse(buffer);
        sendEvent({
          token: chunk.message?.content || "",
          model: chunk.model || model,
          done: Boolean(chunk.done)
        });
      } catch {
        // ignore malformed trailing chunks
      }
    }

    res.end();
  } catch (error) {
    if (error.name === "AbortError") {
      console.log("[Request Aborted] Client closed connection or stopped generation.");
      if (!res.writableEnded) {
        res.end();
      }
      return;
    }

    console.error("[Streaming Error]", error.message);

    if (res.headersSent) {
      if (!res.destroyed && !res.writableEnded) {
        res.write(
          `data: ${JSON.stringify({
            error: "The response was interrupted. Please try again."
          })}\n\n`
        );
        res.end();
      }
    } else {
      res.status(error.name === "TimeoutError" ? 504 : 503).json({
        error:
          error.name === "TimeoutError"
            ? "The model took too long to respond (timeout 120s)."
            : "Could not connect to Ollama server."
      });
    }
  }
});

// Fallback route for SPA: only handle HTML navigation, NEVER intercept missing code/assets
app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/api/")) return next();

  // If requesting a static file with an extension (e.g. .js, .css, .svg, .map), return 404 instead of index.html
  if (/\.[a-zA-Z0-9]+$/.test(req.path)) {
    return res.status(404).type("text/plain").send("Asset not found");
  }

  for (const dirPath of distPaths) {
    const indexPath = path.join(dirPath, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    }
  }
  next();
});

// Centralized error handler
app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes("CORS")) {
    return res.status(403).json({ error: err.message });
  }
  console.error("[Unhandled Error]", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(`Chatbot Server running on http://localhost:${PORT}`);
  console.log(`Chat Model:    ${CHAT_MODEL}`);
  console.log(`Reading Model: ${READING_MODEL}`);
  console.log(`Ollama URL:    ${OLLAMA_URL}`);
  console.log(`CORS Origins:  ${allAllowedOrigins.join(", ")}`);
  console.log(`=========================================`);
});