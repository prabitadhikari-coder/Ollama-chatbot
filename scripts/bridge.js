/**
 * Local Communication Bridge Server
 * Simulates the exact behavior of the Cloudflare Worker proxy on your local machine.
 * 
 * Default Port: 9000
 * Forwarding to: http://localhost:8000 (FastAPI Security Gateway) or active ngrok URL
 * 
 * Run with: node scripts/bridge.js
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

let UPSTREAM_TARGET = (process.env.BRIDGE_TARGET || 'http://localhost:8000').replace(/\/+$/, '');
const PORT = process.env.BRIDGE_PORT || 9000;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Max-Age', '86400');
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  // Management endpoint to inspect or switch upstream target live
  if (req.url.startsWith('/bridge/status')) {
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({
      bridge: 'Active',
      port: PORT,
      currentTarget: UPSTREAM_TARGET,
      timestamp: new Date().toISOString()
    }));
  }

  if (req.url.startsWith('/bridge/set-target') && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        const json = JSON.parse(body);
        if (json.target) {
          UPSTREAM_TARGET = json.target.replace(/\/+$/, '');
          console.log(`[Bridge] Switched target upstream to: ${UPSTREAM_TARGET}`);
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ success: true, newTarget: UPSTREAM_TARGET }));
        }
      } catch {}
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Invalid target JSON. Expected {"target": "http://..."}' }));
    });
    return;
  }

  // Construct target upstream destination URL
  let targetUrlStr = `${UPSTREAM_TARGET}${req.url}`;
  let targetUrl;
  try {
    targetUrl = new URL(targetUrlStr);
  } catch (err) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ error: `Malformed URL: ${err.message}` }));
  }

  console.log(`[Bridge Proxy] ${req.method} ${req.url} -> ${targetUrlStr}`);

  const isHttps = targetUrl.protocol === 'https:';
  const clientLib = isHttps ? https : http;

  // Filter and forward headers
  const forwardHeaders = { ...req.headers };
  delete forwardHeaders.host;
  forwardHeaders['ngrok-skip-browser-warning'] = 'true';

  const proxyReqOptions = {
    hostname: targetUrl.hostname,
    port: targetUrl.port || (isHttps ? 443 : 80),
    path: targetUrl.pathname + targetUrl.search,
    method: req.method,
    headers: forwardHeaders,
    timeout: 120000
  };

  const proxyReq = clientLib.request(proxyReqOptions, (proxyRes) => {
    // Preserve response headers and re-apply universal CORS
    for (const [key, value] of Object.entries(proxyRes.headers)) {
      if (!['access-control-allow-origin', 'content-security-policy', 'x-frame-options'].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    }
    setCorsHeaders(res);
    res.statusCode = proxyRes.statusCode;

    // Stream chunks directly (supports SSE token-by-token streaming)
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[Bridge Error] Could not reach ${UPSTREAM_TARGET}:`, err.message);
    if (!res.headersSent) {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Communication Bridge Error: Cannot reach target backend.',
        target: UPSTREAM_TARGET,
        details: err.message
      }));
    }
  });

  // Pipe request body if any
  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log('=======================================================');
  console.log(`   NexusAI Local Communication Bridge Active`);
  console.log(`   Listening at:      http://localhost:${PORT}`);
  console.log(`   Proxying to:       ${UPSTREAM_TARGET}`);
  console.log(`   Universal CORS:    Enabled (*)`);
  console.log(`   Streaming SSE:     Enabled`);
  console.log('=======================================================');
});
