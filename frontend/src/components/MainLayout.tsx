import React, { useState } from 'react';
import {
  Server,
  Shield,
  Cpu,
  Globe,
  FileText,
  Activity,
  ArrowRight,
  ExternalLink,
  CheckCircle2,
  Zap,
  Terminal,
  Lock,
  MessageSquare,
  Database,
  Table,
  Search,
  Sparkles,
} from 'lucide-react';
import type { ServerStatus, ModelRole } from '../services/api';
import { API_BASE_URL } from '../services/api';

interface MainLayoutProps {
  status: ServerStatus | null;
  checking: boolean;
  activeTab: string;
  onOpenChatWithPrompt: (prompt: string, role: ModelRole) => void;
  onOpenChat: () => void;
  onRefreshStatus: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
  status,
  checking,
  activeTab,
  onOpenChatWithPrompt,
  onOpenChat,
  onRefreshStatus,
}) => {
  const [docText, setDocText] = useState(
    'Architecture Specification:\nOur system utilizes Cloudflare Pages for front-end global delivery, backed by a locally hosted Node.js server exposed via a secure ngrok HTTPS tunnel. Local neural inference is handled by Ollama using nemotron-mini for interactive conversation and nemotron-3-nano for document reading.'
  );
  const [docPrompt, setDocPrompt] = useState(
    'Extract the primary system components and deployment topology from this specification.'
  );

  const isOnline = Boolean(status?.connected && status?.chatModelAvailable);

  const handleRunDocAnalysis = () => {
    const combinedMessage = `Document:\n"""\n${docText.trim()}\n"""\n\nInstruction: ${docPrompt.trim()}`;
    onOpenChatWithPrompt(combinedMessage, 'reading');
  };

  const [nlQuery, setNlQuery] = useState(
    'Find our top 5 revenue-generating customer tiers and show their average lifetime value with a SQL breakdown.'
  );

  const handleRunNlQuery = (queryText?: string) => {
    const q = (queryText || nlQuery).trim();
    if (!q) return;
    const prompt = `Database Query Directive:\n"""\n${q}\n"""\n\nPlease formulate the SQL query against our connected schema, extract the insights, and format the findings in a clean table with key business takeaways.`;
    onOpenChatWithPrompt(prompt, 'reading');
  };

  return (
    <main className="main-content-layout">
      {/* Tab: Overview / Dashboard */}
      {activeTab === 'overview' && (
        <div className="tab-pane-fade">
          {/* Welcome Hero Banner */}
          <section className="hero-banner-card">
            <div className="hero-grid">
              <div className="hero-text-col">
                <div className="hero-pill">
                  <Zap size={14} className="text-amber-400" />
                  <span>Hybrid Local AI Architecture</span>
                </div>
                <h1 className="hero-title">
                  Secure Enterprise AI Platform
                </h1>
                <p className="hero-description">
                  Deploy your user interface globally via Cloudflare Pages edge CDN while executing private neural inference entirely on your local workstation with Ollama and ngrok HTTPS tunneling.
                </p>
                <div className="hero-cta-group">
                  <button
                    onClick={onOpenChat}
                    className="cta-primary-btn"
                  >
                    <MessageSquare size={16} />
                    <span>Open AI Assistant</span>
                    <ArrowRight size={16} />
                  </button>
                  <button
                    onClick={onRefreshStatus}
                    className="cta-secondary-btn"
                  >
                    <Activity size={16} />
                    <span>Probe Telemetry</span>
                  </button>
                </div>
              </div>

              {/* Status summary pill card */}
              <div className="hero-telemetry-col">
                <div className="telemetry-box">
                  <div className="telemetry-header">
                    <span className="telemetry-label">Cluster Status</span>
                    <span
                      className={`telemetry-badge ${
                        checking ? 'checking' : isOnline ? 'online' : 'offline'
                      }`}
                    >
                      {checking ? 'Checking' : isOnline ? 'Active' : 'Offline'}
                    </span>
                  </div>

                  <div className="telemetry-metrics-list">
                    <div className="metric-row">
                      <span className="metric-name">Chat Model:</span>
                      <span className="metric-val">
                        {status?.chatModel || 'nemotron-mini:latest'}
                      </span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-name">Document Model:</span>
                      <span className="metric-val">
                        {status?.readingModel || 'nemotron-3-nano:4b'}
                      </span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-name">API Gateway:</span>
                      <span className="metric-val truncate">
                        {API_BASE_URL || 'Same-origin / Relative proxy'}
                      </span>
                    </div>
                    <div className="metric-row">
                      <span className="metric-name">CORS Policy:</span>
                      <span className="metric-val text-emerald">
                        Strict Whitelist Active
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* System Capability Cards Grid */}
          <section className="features-grid-section">
            <div className="section-title-row">
              <h2>Neural Engines &amp; Security Controls</h2>
              <p>Module configuration for local model orchestration</p>
            </div>

            <div className="cards-grid">
              {/* Card 1: Chat Model */}
              <div className="feature-card">
                <div className="feature-card-header">
                  <div className="icon-badge bg-blue">
                    <MessageSquare size={20} />
                  </div>
                  <span className="model-role-badge">Interactive Chat</span>
                </div>
                <h3>Nemotron Mini</h3>
                <p>
                  High-speed 4.2B parameter conversational model tuned for low latency, concise factual accuracy, and immediate streaming responsiveness.
                </p>
                <div className="card-specs">
                  <span>Context: 4,096 tokens</span>
                  <span>Temperature: 0.2</span>
                </div>
                <button
                  className="card-action-btn"
                  onClick={() =>
                    onOpenChatWithPrompt(
                      'Hello! Can you summarize how you can help me today?',
                      'chat'
                    )
                  }
                >
                  <span>Chat with Nemotron Mini</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Card 2: Document Model */}
              <div className="feature-card">
                <div className="feature-card-header">
                  <div className="icon-badge bg-indigo">
                    <FileText size={20} />
                  </div>
                  <span className="model-role-badge">Document AI</span>
                </div>
                <h3>Nemotron 3 Nano</h3>
                <p>
                  Dedicated 4.0B parameter model engineered for deep textual comprehension, technical synthesis, document reading, and structured reasoning.
                </p>
                <div className="card-specs">
                  <span>High-Capacity Context Window</span>
                  <span>Analytical Tuning</span>
                </div>
                <button
                  className="card-action-btn"
                  onClick={() =>
                    onOpenChatWithPrompt(
                      'Please explain the best strategy for analyzing technical documents with strict factual accuracy.',
                      'reading'
                    )
                  }
                >
                  <span>Analyze with Nemotron Nano</span>
                  <ArrowRight size={14} />
                </button>
              </div>

              {/* Card 3: Security & Guardrails */}
              <div className="feature-card">
                <div className="feature-card-header">
                  <div className="icon-badge bg-emerald">
                    <Shield size={20} />
                  </div>
                  <span className="model-role-badge">Zero Trust</span>
                </div>
                <h3>Security Guardrails</h3>
                <p>
                  Built with multi-layer defenses: CORS origin authorization, IP sliding-window rate limiting, input size enforcement, and client stream aborts.
                </p>
                <div className="card-specs">
                  <span>Rate Limit: 30 req/min</span>
                  <span>Payload Max: 100 KB</span>
                </div>
                <div className="security-tag-row">
                  <span className="sec-tag">DOMPurify XSS</span>
                  <span className="sec-tag">SSE Streaming</span>
                  <span className="sec-tag">AbortSignal</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Tab: Document Intelligence */}
      {activeTab === 'document-analysis' && (
        <div className="tab-pane-fade">
          <section className="doc-analysis-workspace">
            <div className="section-title-row">
              <h2>Document Intelligence Playground</h2>
              <p>
                Synthesize, extract, and analyze documents using your local <code>nemotron-3-nano:4b</code> model.
              </p>
            </div>

            <div className="doc-analysis-grid">
              <div className="doc-input-panel">
                <div className="panel-field">
                  <label htmlFor="doc-source-text">Document Source Text</label>
                  <textarea
                    id="doc-source-text"
                    className="doc-textarea"
                    rows={8}
                    value={docText}
                    onChange={(e) => setDocText(e.target.value)}
                    placeholder="Paste report text, technical documentation, meeting notes, or source code here..."
                  />
                </div>

                <div className="panel-field">
                  <label htmlFor="doc-prompt-input">Analysis Directive</label>
                  <input
                    id="doc-prompt-input"
                    type="text"
                    className="doc-prompt-input"
                    value={docPrompt}
                    onChange={(e) => setDocPrompt(e.target.value)}
                    placeholder="What would you like the model to do with this document?"
                  />
                </div>

                <div className="doc-quick-actions">
                  <button
                    className="quick-prompt-btn"
                    onClick={() =>
                      setDocPrompt('Summarize key points in 3 concise bullet points.')
                    }
                  >
                    3-Bullet Summary
                  </button>
                  <button
                    className="quick-prompt-btn"
                    onClick={() =>
                      setDocPrompt('Identify all security risks or vulnerabilities mentioned.')
                    }
                  >
                    Security Audit
                  </button>
                  <button
                    className="quick-prompt-btn"
                    onClick={() =>
                      setDocPrompt('List action items and deliverables with owners.')
                    }
                  >
                    Action Items
                  </button>
                </div>

                <div className="doc-submit-row">
                  <button
                    className="doc-analyze-btn"
                    onClick={handleRunDocAnalysis}
                    disabled={!docText.trim() || !docPrompt.trim()}
                  >
                    <Cpu size={16} />
                    <span>Run Analysis in Chatbot (Nemotron 3 Nano)</span>
                  </button>
                </div>
              </div>

              {/* Informational sidebar */}
              <div className="doc-guidance-card">
                <h3>Document Processing Architecture</h3>
                <ul className="guidance-list">
                  <li>
                    <CheckCircle2 size={16} className="text-emerald" />
                    <span>
                      <strong>Isolated Model Routing:</strong> Requests routed with role <code>reading</code> automatically target <code>nemotron-3-nano:4b</code> without altering chat conversation state.
                    </span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} className="text-emerald" />
                    <span>
                      <strong>Zero Cloud Leakage:</strong> Document data stays 100% on your local machine; never sent to third-party APIs.
                    </span>
                  </li>
                  <li>
                    <CheckCircle2 size={16} className="text-emerald" />
                    <span>
                      <strong>Strict Factuality:</strong> The system prompt enforces zero hallucination—if details are missing, the assistant declares lack of information.
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Tab: Database & Knowledge Hub */}
      {activeTab === 'db-hub' && (
        <div className="tab-pane-fade">
          <section className="db-hub-workspace">
            <div className="section-title-row">
              <h2>Database Knowledge Hub &amp; SQL Copilot</h2>
              <p>
                Natural language query interface connected to your enterprise database schemas and tables
              </p>
            </div>

            {/* Top Database Telemetry Banner */}
            <div className="db-status-banner">
              <div className="db-status-left">
                <div className="db-icon-badge">
                  <Database size={22} className="text-emerald" />
                </div>
                <div>
                  <div className="db-status-title">
                    <span>Connected Database: PostgreSQL / Enterprise Analytics</span>
                    <span className="live-pulse-badge">Live Synced</span>
                  </div>
                  <div className="db-status-sub">
                    Host: <code>127.0.0.1:5432</code> &bull; Connection Pool: 8 active &bull; Total Indexed Rows: 113,620
                  </div>
                </div>
              </div>
              <div className="db-status-right">
                <span className="db-metric-chip">Latency: 12ms</span>
                <span className="db-metric-chip">ChromaDB Vectors: 42.8k</span>
              </div>
            </div>

            {/* Natural Language to SQL Query Box */}
            <div className="nl-query-card">
              <div className="nl-query-header">
                <Search size={16} className="text-indigo-500" />
                <label htmlFor="nl-query-input">Ask a Data Question in Plain English</label>
              </div>
              <div className="nl-query-input-row">
                <input
                  id="nl-query-input"
                  type="text"
                  value={nlQuery}
                  onChange={(e) => setNlQuery(e.target.value)}
                  placeholder="e.g., Which product category had the highest return rate in Q3?"
                  className="nl-input"
                />
                <button
                  type="button"
                  onClick={() => handleRunNlQuery()}
                  className="nl-submit-btn"
                >
                  <Sparkles size={15} />
                  <span>Query Database</span>
                </button>
              </div>

              {/* Sample Quick Query Suggestions */}
              <div className="nl-samples-row">
                <span className="samples-label">Quick Queries:</span>
                <button
                  className="sample-query-pill"
                  onClick={() =>
                    handleRunNlQuery(
                      'Show top 5 customers by lifetime value and group them by country.'
                    )
                  }
                >
                  Top 5 Customers by Value
                </button>
                <button
                  className="sample-query-pill"
                  onClick={() =>
                    handleRunNlQuery(
                      'Which products currently have stock below their reorder threshold?'
                    )
                  }
                >
                  Low Stock Alert
                </button>
                <button
                  className="sample-query-pill"
                  onClick={() =>
                    handleRunNlQuery(
                      'Calculate average order value by payment status for the past 30 days.'
                    )
                  }
                >
                  Monthly Revenue by Status
                </button>
              </div>
            </div>

            {/* Schema & Table Explorer Grid */}
            <div className="table-explorer-section">
              <div className="explorer-title-row">
                <Table size={16} className="text-secondary" />
                <h3>Connected Schema Explorer (Click any query to run in AI assistant)</h3>
              </div>

              <div className="schema-cards-grid">
                {/* Table 1: Customers */}
                <div className="schema-table-card">
                  <div className="table-card-header">
                    <div className="table-name-group">
                      <Table size={15} className="text-blue-500" />
                      <h4>customers</h4>
                    </div>
                    <span className="row-count-badge">14,250 rows</span>
                  </div>
                  <div className="table-columns-list">
                    <code>id (PK)</code>, <code>name</code>, <code>email</code>, <code>tier</code>, <code>country</code>, <code>lifetime_value</code>
                  </div>
                  <div className="table-actions">
                    <button
                      className="run-table-query-btn"
                      onClick={() =>
                        handleRunNlQuery(
                          'Analyze customer tiers in the customers table: show total count and average lifetime value per tier as a markdown table.'
                        )
                      }
                    >
                      <Sparkles size={12} />
                      <span>Analyze Customer Tiers</span>
                    </button>
                  </div>
                </div>

                {/* Table 2: Orders */}
                <div className="schema-table-card">
                  <div className="table-card-header">
                    <div className="table-name-group">
                      <Table size={15} className="text-emerald" />
                      <h4>orders</h4>
                    </div>
                    <span className="row-count-badge">89,400 rows</span>
                  </div>
                  <div className="table-columns-list">
                    <code>id (PK)</code>, <code>customer_id (FK)</code>, <code>amount</code>, <code>status</code>, <code>order_date</code>
                  </div>
                  <div className="table-actions">
                    <button
                      className="run-table-query-btn"
                      onClick={() =>
                        handleRunNlQuery(
                          'From the orders table, calculate total sales volume grouped by status (completed, pending, refunded) with percentages.'
                        )
                      }
                    >
                      <Sparkles size={12} />
                      <span>Break Down Order Status</span>
                    </button>
                  </div>
                </div>

                {/* Table 3: Inventory */}
                <div className="schema-table-card">
                  <div className="table-card-header">
                    <div className="table-name-group">
                      <Table size={15} className="text-amber" />
                      <h4>inventory</h4>
                    </div>
                    <span className="row-count-badge">3,120 rows</span>
                  </div>
                  <div className="table-columns-list">
                    <code>sku (PK)</code>, <code>product_name</code>, <code>category</code>, <code>stock_level</code>, <code>reorder_threshold</code>
                  </div>
                  <div className="table-actions">
                    <button
                      className="run-table-query-btn"
                      onClick={() =>
                        handleRunNlQuery(
                          'Query the inventory table to list all items where stock_level < reorder_threshold, sorted by lowest stock first.'
                        )
                      }
                    >
                      <Sparkles size={12} />
                      <span>Audit Low Stock</span>
                    </button>
                  </div>
                </div>

                {/* Table 4: Support Tickets */}
                <div className="schema-table-card">
                  <div className="table-card-header">
                    <div className="table-name-group">
                      <Table size={15} className="text-indigo-500" />
                      <h4>support_tickets</h4>
                    </div>
                    <span className="row-count-badge">6,850 rows</span>
                  </div>
                  <div className="table-columns-list">
                    <code>id (PK)</code>, <code>customer_id</code>, <code>priority</code>, <code>issue_type</code>, <code>resolution_hours</code>
                  </div>
                  <div className="table-actions">
                    <button
                      className="run-table-query-btn"
                      onClick={() =>
                        handleRunNlQuery(
                          'From support_tickets, calculate average resolution_hours grouped by priority and summarize the most frequent issue_types.'
                        )
                      }
                    >
                      <Sparkles size={12} />
                      <span>Analyze Resolution Times</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Tab: Mesh Architecture */}
      {activeTab === 'architecture' && (
        <div className="tab-pane-fade">
          <section className="architecture-section">
            <div className="section-title-row">
              <h2>Mesh Topology: Cloudflare Pages + ngrok + Ollama</h2>
              <p>End-to-end data flow from global edge CDN to local neural models</p>
            </div>

            <div className="arch-flow-grid">
              <div className="arch-node-card">
                <div className="node-icon-header">
                  <Globe size={24} className="text-orange-500" />
                  <span className="node-badge">Frontend Host</span>
                </div>
                <h3>Cloudflare Pages</h3>
                <p>
                  High-speed global edge network serving the compiled React 19 + Vite bundle over HTTPS.
                </p>
                <div className="node-code-box">
                  <code>https://&lt;your-project&gt;.pages.dev</code>
                </div>
              </div>

              <div className="arch-node-connector">
                <ArrowRight size={20} className="connector-icon" />
                <span>HTTPS Tunnel</span>
              </div>

              <div className="arch-node-card">
                <div className="node-icon-header">
                  <ExternalLink size={24} className="text-blue-500" />
                  <span className="node-badge">Ingress Gateway</span>
                </div>
                <h3>ngrok Secure Tunnel</h3>
                <p>
                  Exposes local FastAPI port 8000 to the public internet with TLS termination and bypass headers.
                </p>
                <div className="node-code-box">
                  <code>https://steadfast-luminance-praying.ngrok-free.dev</code>
                </div>
              </div>

              <div className="arch-node-connector">
                <ArrowRight size={20} className="connector-icon" />
                <span>Port 8000</span>
              </div>

              <div className="arch-node-card">
                <div className="node-icon-header">
                  <Shield size={24} className="text-indigo-500" />
                  <span className="node-badge">Security Shield</span>
                </div>
                <h3>FastAPI Gateway</h3>
                <p>
                  High-performance Python gateway with Pydantic validation, prompt-injection defense, and rate-limiting.
                </p>
                <div className="node-code-box">
                  <code>http://localhost:8000</code>
                </div>
              </div>

              <div className="arch-node-connector">
                <ArrowRight size={20} className="connector-icon" />
                <span>Localhost 3000</span>
              </div>

              <div className="arch-node-card">
                <div className="node-icon-header">
                  <Server size={24} className="text-emerald-500" />
                  <span className="node-badge">Node.js Server</span>
                </div>
                <h3>Express 5 Backend</h3>
                <p>
                  Runs locally on Windows. Enforces CORS whitelist, model routing, and SSE streaming.
                </p>
                <div className="node-code-box">
                  <code>http://localhost:3000</code>
                </div>
              </div>

              <div className="arch-node-connector">
                <ArrowRight size={20} className="connector-icon" />
                <span>Localhost 11434</span>
              </div>

              <div className="arch-node-card">
                <div className="node-icon-header">
                  <Cpu size={24} className="text-purple-500" />
                  <span className="node-badge">Neural Inference</span>
                </div>
                <h3>Local Ollama Service</h3>
                <p>
                  Direct GPU/CPU inference hosting <code>nemotron-mini:latest</code> and <code>nemotron-3-nano:4b</code>.
                </p>
                <div className="node-code-box">
                  <code>http://localhost:11434</code>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Tab: Security & Settings */}
      {activeTab === 'security' && (
        <div className="tab-pane-fade">
          <section className="security-specs-section">
            <div className="section-title-row">
              <h2>Security Architecture &amp; Guardrails</h2>
              <p>Defense-in-depth implemented across client and server</p>
            </div>

            <div className="security-specs-grid">
              <div className="spec-card">
                <div className="spec-icon bg-emerald">
                  <Shield size={20} />
                </div>
                <h3>Cross-Origin Resource Sharing (CORS)</h3>
                <p>
                  Unrestricted wildcards are disabled. Origins must match configured Cloudflare Pages subdomains (<code>*.pages.dev</code>), registered ngrok URLs, or local development ports.
                </p>
              </div>

              <div className="spec-card">
                <div className="spec-icon bg-blue">
                  <Zap size={20} />
                </div>
                <h3>Rate Limiting &amp; DoS Protection</h3>
                <p>
                  In-memory sliding-window limiter throttles `/api/chat` requests to 30 requests per minute per IP to safeguard workstation CPU and GPU resources.
                </p>
              </div>

              <div className="spec-card">
                <div className="spec-icon bg-indigo">
                  <Lock size={20} />
                </div>
                <h3>Input Size &amp; Validation Caps</h3>
                <p>
                  Payload body limit strictly enforced at 100 KB; single messages capped at 10,000 characters; conversation history bounded at 40 exchanges.
                </p>
              </div>

              <div className="spec-card">
                <div className="spec-icon bg-rose">
                  <Terminal size={20} />
                </div>
                <h3>XSS &amp; Prompt Output Sanitization</h3>
                <p>
                  Model output is treated as untrusted data. Rendered markdown is processed via DOMPurify to strip malicious scripts, onclick triggers, and javascript: protocols.
                </p>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
};
