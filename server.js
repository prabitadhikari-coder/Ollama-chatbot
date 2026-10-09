
const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

const OLLAMA_URL = "http://localhost:11434";
const CHAT_MODEL = "nemotron-mini:latest";
const READING_MODEL = "nemotron-3-nano:4b";

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

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/status", async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!response.ok) throw new Error("Ollama unavailable");

    const data = await response.json();
    const models = (data.models || []).map((m) => m.name);

    res.json({
      connected: true,
      chatModel: CHAT_MODEL,
      readingModel: READING_MODEL,
      chatModelAvailable: models.includes(CHAT_MODEL),
      readingModelAvailable: models.includes(READING_MODEL)
    });
  } catch {
    res.status(503).json({
      connected: false,
      error: "Cannot connect to Ollama. Check that Ollama is running."
    });
  }
});


app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [], role = "chat" } = req.body;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Please enter a message." });
    }

    if (message.length > 10000) {
      return res.status(413).json({ error: "Message is too long." });
    }

    if (!Array.isArray(history) || history.length > 40) {
      return res.status(400).json({
        error: "Invalid conversation history."
      });
    }

    const model = role === "reading"
      ? READING_MODEL
      : CHAT_MODEL;

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history
        .filter(
          m =>
            m &&
            ["user", "assistant"].includes(m.role) &&
            typeof m.content === "string"
        )
        .slice(-40)
        .map(m => ({
          role: m.role,
          content: m.content
        })),
      { role: "user", content: message.trim() }
    ];

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
      signal: AbortSignal.timeout(120000)
    });

    if (!response.ok) {
      const details = await response.text();
      console.error("Ollama error:", details);

      return res.status(502).json({
        error: "Ollama could not process the request. Check the model and server."
      });
    }

    // Stream Server-Sent Events (SSE) to the browser.
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    function sendEvent(data) {
      if (!res.destroyed) {
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

        const chunk = JSON.parse(line);

        sendEvent({
          token: chunk.message?.content || "",
          model: chunk.model || model,
          done: Boolean(chunk.done)
        });
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      const chunk = JSON.parse(buffer);

      sendEvent({
        token: chunk.message?.content || "",
        model: chunk.model || model,
        done: Boolean(chunk.done)
      });
    }

    res.end();
  } catch (error) {
    console.error("Streaming error:", error.message);

    if (res.headersSent) {
      if (!res.destroyed) {
        res.write(`data: ${JSON.stringify({
          error: "The response was interrupted. Please try again."
        })}\n\n`);
        res.end();
      }
    } else {
      res.status(error.name === "TimeoutError" ? 504 : 503).json({
        error: error.name === "TimeoutError"
          ? "The model took too long to respond."
          : "Could not connect to Ollama."
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Chatbot running at http://localhost:${PORT}`);
  console.log(`Chat model: ${CHAT_MODEL}`);
  console.log(`Reading model: ${READING_MODEL}`);
});