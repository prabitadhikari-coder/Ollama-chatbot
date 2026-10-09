
const toggle = document.getElementById("chat-toggle");
const panel = document.getElementById("chat-panel");
const closeButton = document.getElementById("chat-close");
const newChatButton = document.getElementById("new-chat");
const form = document.getElementById("chat-form");
const input = document.getElementById("message-input");
const messagesEl = document.getElementById("messages");
const typing = document.getElementById("typing");
const sendButton = document.getElementById("send-button");
const roleSelect = document.getElementById("model-role");
const modelName = document.getElementById("model-name");
const statusEl = document.getElementById("connection-status");

let history = [];
let busy = false;
let available = false;
let modelNames = { chat: "nemotron-mini:latest", reading: "nemotron-3-nano:4b" };

function setOpen(open) {
  panel.hidden = !open;
  toggle.setAttribute("aria-expanded", String(open));
  toggle.setAttribute("aria-label", open ? "Minimize chat" : "Open chat");
  if (open) input.focus();
}

toggle.addEventListener("click", () => setOpen(panel.hidden));
closeButton.addEventListener("click", () => setOpen(false));

function updateModelLabel() {
  const role = roleSelect.value;
  const label = role === "chat" ? "Chat" : "Reading";
  modelName.textContent = `Model: ${modelNames[role]} | Role: ${label}`;
}

roleSelect.addEventListener("change", updateModelLabel);

async function checkStatus() {
  try {
    const response = await fetch("/api/status");
    const data = await response.json();

    if (!response.ok || !data.connected) {
      throw new Error("Ollama is not connected");
    }

    available = data.chatModelAvailable;

    modelNames.chat = data.chatModel;
    modelNames.reading = data.readingModel;

    statusEl.textContent = available
      ? "Ollama connected"
      : "Chat model not installed";

    updateModelLabel();
  } catch {
    available = false;
    statusEl.textContent = "Ollama unavailable";
    modelName.textContent = "Check your Ollama connection";
  }
}

function addMessage(text, role, model = null) {
  const bubble = document.createElement("div");
  bubble.className = `message ${role}`;

  const content = document.createElement("div");

  if (role === "assistant" && window.marked && window.DOMPurify) {
    content.innerHTML = DOMPurify.sanitize(
      marked.parse(text, { breaks: true })
    );
  } else {
    content.textContent = text;
  }

  bubble.appendChild(content);

  if (model) {
    const tag = document.createElement("span");
    tag.className = "model-tag";
    tag.textContent = `Model: ${model}`;
    bubble.appendChild(tag);
  }

  messagesEl.appendChild(bubble);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return bubble;
}


form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = input.value.trim();
  if (!message || busy) return;

  if (!available) {
    await checkStatus();

    if (!available) {
      addMessage(
        "Ollama or the chat model is unavailable. Please check your setup.",
        "assistant"
      );
      return;
    }
  }

  const role = roleSelect.value;

  addMessage(message, "user");
  input.value = "";
  input.style.height = "auto";

  busy = true;
  sendButton.disabled = true;
  typing.hidden = false;

  let assistantBubble = null;
  let content = null;
  let modelTag = null;
  let fullReply = "";
  let actualModel = modelNames[role];
  let streamError = null;

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history,
        role
      })
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Request failed");
    }

    if (!response.body) {
      throw new Error("Your browser does not support response streaming.");
    }

    // Create an empty assistant bubble immediately.
    assistantBubble = addMessage("", "assistant", actualModel);
    content = assistantBubble.querySelector("div");
    modelTag = assistantBubble.querySelector(".model-tag");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    function processEvent(eventText) {
      const line = eventText
        .split("\n")
        .find(line => line.startsWith("data:"));

      if (!line) return;

      const data = JSON.parse(line.slice(5).trim());

      if (data.error) {
        streamError = data.error;
        return;
      }

      if (data.model) {
        actualModel = data.model;

        if (modelTag) {
          modelTag.textContent = `Model: ${actualModel}`;
        }
      }

      if (data.token) {
        fullReply += data.token;

        // Show the new text immediately.
        content.textContent = fullReply;
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }

    while (true) {
      const { value, done } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const eventText of events) {
        processEvent(eventText);
      }
    }

    buffer += decoder.decode();

    if (buffer.trim()) {
      processEvent(buffer);
    }

    if (streamError) {
      throw new Error(streamError);
    }

    if (!fullReply) {
      throw new Error("The model returned an empty response.");
    }

    // Render Markdown after generation finishes.
    if (window.marked && window.DOMPurify) {
      content.innerHTML = DOMPurify.sanitize(
        marked.parse(fullReply, { breaks: true })
      );
    }

    history.push(
      { role: "user", content: message },
      { role: "assistant", content: fullReply }
    );

    history = history.slice(-40);
    updateModelLabel();
  } catch (error) {
    addMessage(`Error: ${error.message}`, "assistant");
  } finally {
    busy = false;
    sendButton.disabled = false;
    typing.hidden = true;
    input.focus();
  }
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 100)}px`;
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

newChatButton.addEventListener("click", () => {
  if (busy) return;

  history = [];
  messagesEl.replaceChildren();

  addMessage("Hi! How can I help you today?", "assistant");
});

checkStatus();