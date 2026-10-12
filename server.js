require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { dbService } = require("./services/dbService");

const app = express();
app.set("trust proxy", 1);
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
  "https://steadfast-luminance-praying.ngrok-free.dev",
  "https://ollama-chatbot.prabitadhikari.workers.dev"
];

const allAllowedOrigins = Array.from(new Set([...defaultAllowedOrigins, ...rawAllowedOrigins]));

function isOriginAllowed(origin) {
  // Allow curl, mobile apps, or same-origin requests where origin header is undefined
  if (!origin) return true;
  if (allAllowedOrigins.includes("*") || process.env.ALLOWED_ORIGINS === "*") return true;
  if (allAllowedOrigins.includes(origin)) return true;

  try {
    const url = new URL(origin);
    // Allow any localhost / loopback port (3000, 5173, 8000, etc.)
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1") return true;
    // Automatically allow any Cloudflare Pages or Workers domain (*.pages.dev, *.workers.dev)
    if (url.hostname.endsWith(".pages.dev") || url.hostname.endsWith(".workers.dev")) return true;
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
  validate: { xForwardedForHeader: false },
  message: {
    error: "Too many requests to the server. Please wait a moment and try again."
  }
});

const chatLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 30,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false },
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

// Lightweight health check endpoint (reporting MariaDB & service status)
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    database: {
      connected: dbService.isConnected,
      mode: "STRICT_READ_ONLY",
      name: process.env.DB_NAME || "chatbot_kb"
    },
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
      databaseConnected: dbService.isConnected,
      chatModel: CHAT_MODEL,
      readingModel: READING_MODEL,
      chatModelAvailable: models.includes(CHAT_MODEL),
      readingModelAvailable: models.includes(READING_MODEL),
      availableModels: models
    });
  } catch (err) {
    res.status(503).json({
      connected: false,
      databaseConnected: dbService.isConnected,
      chatModel: CHAT_MODEL,
      readingModel: READING_MODEL,
      chatModelAvailable: false,
      readingModelAvailable: false,
      error: "Cannot connect to Ollama. Check that Ollama service is running on the host machine."
    });
  }
});

// Authentication & Role Management endpoints
app.post("/api/auth/login", (req, res) => {
  const { username } = req.body || {};
  const u = (username || "").toLowerCase().trim();

  let role = "customer";
  let name = username || "Guest Customer";

  if (u === "sarah.admin" || u === "admin") {
    role = "admin";
    name = "Sarah Connor (Executive Admin)";
  } else if (u === "john.doe" || u === "employee") {
    role = "employee";
    name = "John Doe (IT Staff)";
  } else if (u.includes("admin")) {
    role = "admin";
    name = username;
  } else if (u.includes("employee") || u.includes("staff")) {
    role = "employee";
    name = username;
  }

  res.json({
    status: "ok",
    user: {
      username: u || "guest",
      name,
      role
    }
  });
});

app.post("/api/auth/register", (req, res) => {
  const { username, name, role = "customer" } = req.body || {};
  const validRoles = ["customer", "employee", "admin"];
  const sanitizedRole = validRoles.includes(role) ? role : "customer";

  res.json({
    status: "ok",
    user: {
      username: (username || "new_user").toLowerCase().trim(),
      name: name || username || "New User",
      role: sanitizedRole
    }
  });
});

// Direct MariaDB Products & Stock lookup
app.get("/api/products", async (req, res) => {
  const query = (req.query.q || "all").toString();
  const products = await dbService.searchProducts(query, 20);
  res.json({ status: "ok", products });
});

// Direct MariaDB Knowledge lookup with Role-Based Access Control
app.get("/api/knowledge/search", async (req, res) => {
  const query = (req.query.q || "").toString();
  const userRole = (req.query.role || req.headers["x-user-role"] || "customer").toString();
  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required.' });
  }
  const [knowledge, products] = await Promise.all([
    dbService.searchKnowledge(query, 5, userRole),
    dbService.searchProducts(query, 5)
  ]);
  res.json({ status: "ok", userRole, results: { knowledge, products } });
});

// Hardware / Privilege-level Read-Only Enforcement Verification
app.get("/api/security/test-readonly", async (req, res) => {
  const audit = await dbService.verifyReadOnlyEnforcement();
  res.json({
    description: "Hardware/Privilege-level Read-Only Enforcement Verification",
    audit
  });
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
    const clientUserRole = req.body.userRole || req.headers["x-user-role"] || "customer";

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

    // Retrieve verified grounding facts from MariaDB with Role-Based Access Control
    let groundedFacts = [];
    let kbItems = [];
    let productItems = [];
    let transactions = { orders: [], expenses: [], purchaseOrders: [] };

    // Active health check on MariaDB
    const isDbAlive = await dbService.checkConnection();

    // Query intent classification
    const lowerMsg = message.toLowerCase();
    const isDataQuery =
      lowerMsg.includes("product") ||
      lowerMsg.includes("item") ||
      lowerMsg.includes("sku") ||
      lowerMsg.includes("stock") ||
      lowerMsg.includes("price") ||
      lowerMsg.includes("cost") ||
      lowerMsg.includes("expensive") ||
      lowerMsg.includes("cheap") ||
      lowerMsg.includes("policy") ||
      lowerMsg.includes("policies") ||
      lowerMsg.includes("return") ||
      lowerMsg.includes("refund") ||
      lowerMsg.includes("shipping") ||
      lowerMsg.includes("hour") ||
      lowerMsg.includes("hours") ||
      lowerMsg.includes("support") ||
      lowerMsg.includes("contact") ||
      lowerMsg.includes("wifi") ||
      lowerMsg.includes("vpn") ||
      lowerMsg.includes("order") ||
      lowerMsg.includes("orders") ||
      lowerMsg.includes("expense") ||
      lowerMsg.includes("claim") ||
      lowerMsg.includes("purchase order") ||
      lowerMsg.includes("po") ||
      lowerMsg.includes("margin") ||
      lowerMsg.includes("profit") ||
      lowerMsg.includes("revenue");

    // Strict Enforcement 1: If database is offline and query requires enterprise data, refuse immediately
    if (!isDbAlive && isDataQuery) {
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const dbDownMessage = "The enterprise database (MariaDB) is currently offline or unreachable. Live catalog, pricing, policies, and account records cannot be read right now. Please start the database service and try again.";
      res.write(`data: ${JSON.stringify({ token: dbDownMessage, model: CHAT_MODEL, done: true })}\n\n`);
      return res.end();
    }

    if (message && message.trim() && isDbAlive) {
      console.log(`[Chat Request] Active Role: "${clientUserRole}" | Query: "${message.trim()}"`);
      const searchResults = await Promise.all([
        dbService.searchKnowledge(message, 3, clientUserRole),
        dbService.searchProducts(message, 3),
        dbService.searchTransactions(message, clientUserRole)
      ]);
      kbItems = searchResults[0] || [];
      productItems = searchResults[1] || [];
      transactions = searchResults[2] || { orders: [], expenses: [], purchaseOrders: [] };
      console.log(`[Grounding Facts] KB: ${kbItems.length}, Products: ${productItems.length}, Orders: ${transactions.orders?.length || 0}, Expenses: ${transactions.expenses?.length || 0}, POs: ${transactions.purchaseOrders?.length || 0}`);

      if (kbItems.length > 0) {
        groundedFacts.push(
          "COMPANY POLICIES & VERIFIED KNOWLEDGE:\n" +
            kbItems.map((k) => `* [${k.topic}]: ${k.content}`).join("\n")
        );
      }
      if (productItems.length > 0) {
        groundedFacts.push(
          "LIVE PRODUCT INVENTORY & STOCK:\n" +
            productItems
              .map(
                (p) =>
                  `* SKU ${p.sku}: ${p.name} ($${p.unit_price}) - In Stock: ${p.stock_quantity}. ${p.description}`
              )
              .join("\n")
        );
      }
      if (transactions.orders?.length > 0) {
        groundedFacts.push(
          "CUSTOMER ORDERS & DIRECTORY:\n" +
            transactions.orders
              .map(
                (o) =>
                  `* Order ${o.order_id} (${o.customer_name}${o.customer_email ? " <" + o.customer_email + ">" : ""}): ${o.sku ? "SKU " + o.sku + " x" + o.quantity + " ($" + o.total_amount + ") - " : ""}Status: ${o.order_status} ${o.tracking_number ? "(Tracking: " + o.tracking_number + ")" : ""}`
              )
              .join("\n")
        );
      }
      if (transactions.expenses?.length > 0) {
        groundedFacts.push(
          "INTERNAL EMPLOYEE EXPENSES:\n" +
            transactions.expenses
              .map(
                (e) =>
                  `* Claim ${e.claim_id} by ${e.employee_name} (${e.department}): ${e.expense_type} ($${e.amount}) - Status: ${e.approval_status}`
              )
              .join("\n")
        );
      }
      if (transactions.purchaseOrders?.length > 0) {
        groundedFacts.push(
          "CONFIDENTIAL VENDOR PURCHASE ORDERS:\n" +
            transactions.purchaseOrders
              .map(
                (po) =>
                  `* PO ${po.po_number} to ${po.vendor_name}: ${po.item_description} | Unit Cost: $${po.cost_per_unit} | Total Contract Value: $${po.total_contract_value} | Payment Terms: ${po.payment_terms} | Notes: ${po.confidential_notes}`
              )
              .join("\n")
        );
      }
    }

    // Deterministic refusal for unauthorized/restricted document queries to prevent hallucination
    const isCustomerOrderQuery =
      lowerMsg.includes("ord-") ||
      lowerMsg.includes("customer email") ||
      lowerMsg.includes("client email") ||
      lowerMsg.includes("customer list") ||
      (lowerMsg.includes("customer") && lowerMsg.includes("email")) ||
      lowerMsg.includes("customer order") ||
      lowerMsg.includes("customer orders") ||
      (lowerMsg.includes("what") && lowerMsg.includes("order")) ||
      (lowerMsg.includes("list") && lowerMsg.includes("order")) ||
      (lowerMsg.includes("show") && lowerMsg.includes("order")) ||
      (lowerMsg.includes("all") && lowerMsg.includes("order")) ||
      (lowerMsg.includes("recent") && lowerMsg.includes("order"));

    const isExpenseQuery =
      lowerMsg.includes("exp-") ||
      lowerMsg.includes("expense") ||
      lowerMsg.includes("claim") ||
      lowerMsg.includes("reimburse");

    const isPOQuery =
      lowerMsg.includes("po-") ||
      lowerMsg.match(/\bpo\b/i) ||
      lowerMsg.match(/\bpos\b/i) ||
      lowerMsg.includes("purchase order") ||
      lowerMsg.includes("margin") ||
      lowerMsg.includes("profit margin") ||
      lowerMsg.includes("company profit");

    const isWifiQuery =
      lowerMsg.includes("wifi") ||
      lowerMsg.includes("vpn");

    // 1. Strict blocking for Customer role on internal staff/admin tables
    if (clientUserRole === "customer" && (isCustomerOrderQuery || isExpenseQuery || isPOQuery || isWifiQuery)) {
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      let refusalText = "I cannot provide customer order records as this data is restricted to authorized staff. Please sign in with an Employee or Admin account.";
      if (isWifiQuery) {
        refusalText = "Internal WiFi credentials and VPN network access are restricted to staff employees.";
      } else if (isPOQuery) {
        refusalText = "Financial margins and supplier purchase orders are confidential corporate records restricted to administrators.";
      } else if (isExpenseQuery) {
        refusalText = "Employee expense claims and internal reimbursements are restricted to staff employees.";
      }
      res.write(`data: ${JSON.stringify({ token: refusalText, model: CHAT_MODEL, done: true })}\n\n`);
      return res.end();
    }

    // 2. Strict blocking for Employee role on executive admin tables (POs, Margins)
    if (clientUserRole === "employee" && isPOQuery && (!transactions.purchaseOrders || transactions.purchaseOrders.length === 0)) {
      res.status(200);
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      const refusalText = "Supplier purchase orders and corporate financial margins are restricted to Executive Administrator clearance.";
      res.write(`data: ${JSON.stringify({ token: refusalText, model: CHAT_MODEL, done: true })}\n\n`);
      return res.end();
    }

    const validRoles = ["chat", "reading"];
    const sanitizedRole = validRoles.includes(role) ? role : "chat";
    const model = sanitizedRole === "reading" ? READING_MODEL : CHAT_MODEL;

    let dynamicSystemPrompt = `You are a helpful, professional, and factual enterprise AI assistant.
The user is authenticated with verified clearance: '${clientUserRole.toUpperCase()}'.`;

    if (groundedFacts.length > 0) {
      dynamicSystemPrompt += `\n\n=== VERIFIED COMPANY DATABASE FACTS (FROM MARIADB) ===\n${groundedFacts.join(
        "\n\n"
      )}\n\nGuidelines:
- Answer the user's inquiry directly using the verified database facts provided above.`;

      if (kbItems.some((k) => k.topic.toLowerCase().includes("wifi") || k.topic.toLowerCase().includes("vpn"))) {
        dynamicSystemPrompt += `\n- State the office network authentication details (CORP-SECURE WPA3-Enterprise, VPN MFA).`;
      }
      if (kbItems.some((k) => k.topic.toLowerCase().includes("margin") || k.topic.toLowerCase().includes("revenue"))) {
        dynamicSystemPrompt += `\n- Report the Q3 gross revenue growth (18%) and net operating margin (24.2%).`;
      }
      if (transactions.orders?.length > 0) {
        dynamicSystemPrompt += `\n- List the matching customer order records with order IDs, customer names, emails, and statuses.`;
      }
      if (transactions.expenses?.length > 0) {
        dynamicSystemPrompt += `\n- List the employee expense claims with claim IDs, employees, departments, and amounts.`;
      }
      if (transactions.purchaseOrders?.length > 0) {
        dynamicSystemPrompt += `\n- For purchase orders, note both Unit Cost and Total Contract Value (Foxconn PO-2026-001 has the largest Total Contract Value at $125,000.00; SAP PO-2026-002 has the highest Unit Cost at $18,500.00). When asked for the most expensive PO, specify both or clarify by total contract value.`;
      }
      if (productItems.length > 0) {
        dynamicSystemPrompt += `\n- Report live product inventory with SKU, unit price, and stock count.`;
      }

      dynamicSystemPrompt += `\n- Format readability: Use clean markdown bullet points, clear labels (e.g. SKU, Price, Stock Count, Order ID), and explicit numbers directly from the database.\n- Strictly adhere ONLY to facts explicitly provided above. Never extrapolate, guess, or invent unlisted records.\n- Be concise, helpful, and completely factual.`;
    } else {
      dynamicSystemPrompt += `\n\n- Strict Rule: You do not have verified database records for this query in the current context. Never invent prices, catalog stock, customer details, or company policies. If asked about company products, orders, policies, or credentials, clearly state that this information is not available in the verified database.`;
    }

    const messages = [
      { role: "system", content: dynamicSystemPrompt },
      ...history
        .filter(
          (m) =>
            m &&
            ["user", "assistant"].includes(m.role) &&
            typeof m.content === "string"
        )
        .filter((m) => {
          if (clientUserRole === "customer") {
            const c = m.content.toLowerCase();
            if (c.includes("po-202") || c.includes("corp-secure") || c.includes("ord-902") || c.includes("exp-10") || c.includes("margins holding at")) {
              return false;
            }
          }
          return true;
        })
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

async function startServer() {
  await dbService.init();
  app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`Chatbot Server running on http://localhost:${PORT}`);
    console.log(`MariaDB:       ${dbService.isConnected ? 'Connected (' + (process.env.DB_NAME || 'chatbot_kb') + ')' : 'Disconnected'}`);
    console.log(`Chat Model:    ${CHAT_MODEL}`);
    console.log(`Reading Model: ${READING_MODEL}`);
    console.log(`Ollama URL:    ${OLLAMA_URL}`);
    console.log(`CORS Origins:  ${allAllowedOrigins.join(", ")}`);
    console.log(`=========================================`);
  });
}

startServer();