/**
 * One-Command Local Stack Launcher for NexusAI
 * Starts:
 * 1. Node.js backend (port 3000)
 * 2. FastAPI Security Gateway (port 8000)
 * 3. ngrok HTTPS tunnel (port 8000)
 * Automatically fetches the live ngrok public URL and checks health.
 * Run with: npm run start:all  or  node scripts/start-all.js
 */

const { spawn } = require('child_process');
const http = require('http');

console.log('=======================================================');
console.log('   NexusAI Local Stack Automated Launcher');
console.log('=======================================================\n');

// Track spawned child processes for clean exit
const processes = [];

function cleanup() {
  console.log('\n[Shutdown] Stopping all services...');
  for (const proc of processes) {
    try {
      if (proc && !proc.killed) {
        proc.kill('SIGTERM');
      }
    } catch {}
  }
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// 1. Verify Ollama is reachable
function checkOllama() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:11434/api/tags', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

// 2. Fetch active ngrok tunnel URL from ngrok's local client API
function getNgrokPublicUrl() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const httpsTunnel = (json.tunnels || []).find((t) => t.public_url.startsWith('https'));
          if (httpsTunnel) {
            resolve(httpsTunnel.public_url);
            return;
          }
          if (json.tunnels && json.tunnels.length > 0) {
            resolve(json.tunnels[0].public_url);
            return;
          }
        } catch {}
        resolve(null);
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(null);
    });
  });
}

async function main() {
  // Check Ollama
  process.stdout.write('[1/4] Checking Ollama status... ');
  const ollamaOk = await checkOllama();
  if (ollamaOk) {
    console.log('✓ Online (http://localhost:11434)');
  } else {
    console.log('⚠ Ollama not responding on port 11434. Make sure Ollama desktop app or `ollama serve` is running.');
  }

  // Start Node.js backend
  console.log('[2/4] Starting Node.js backend on http://localhost:3000...');
  const nodeProc = spawn('node', ['server.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  processes.push(nodeProc);

  nodeProc.stdout.on('data', (d) => {
    const line = d.toString().trim();
    if (line) console.log(`  [Node] ${line}`);
  });
  nodeProc.stderr.on('data', (d) => {
    const line = d.toString().trim();
    if (line) console.error(`  [Node Error] ${line}`);
  });

  // Start FastAPI Security Gateway
  console.log('[3/4] Starting FastAPI Security Gateway on http://localhost:8000...');
  const pyProc = spawn('python', ['-m', 'uvicorn', 'gateway.main:app', '--host', '0.0.0.0', '--port', '8000'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true,
  });
  processes.push(pyProc);

  pyProc.stdout.on('data', (d) => {
    const line = d.toString().trim();
    if (line && line.includes('Application startup complete')) {
      console.log('  [FastAPI] ✓ Gateway initialized and ready on port 8000');
    }
  });

  // Start ngrok tunnel on port 8000
  console.log('[4/4] Starting ngrok tunnel forwarding to port 8000...');
  const ngrokProc = spawn('ngrok', ['http', '8000'], {
    stdio: 'ignore',
    shell: true,
  });
  processes.push(ngrokProc);

  // Poll for ngrok URL
  console.log('      Discovering public ngrok HTTPS address...');
  let publicUrl = null;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    publicUrl = await getNgrokPublicUrl();
    if (publicUrl) break;
  }

  console.log('\n=======================================================');
  if (publicUrl) {
    console.log(`🚀 STACK ONLINE! Live ngrok HTTPS Tunnel:`);
    console.log(`   ${publicUrl}`);
    console.log('=======================================================');
    console.log(`\nTo connect your Cloudflare Pages website:`);
    console.log(`1. Visit your Cloudflare Pages URL in browser`);
    console.log(`2. If the status says 'Offline', click on the status badge in the header`);
    console.log(`3. Paste your ngrok URL above and click 'Save & Test'`);
    console.log(`\nLocal endpoints:`);
    console.log(`• Node.js Backend:    http://localhost:3000`);
    console.log(`• FastAPI Gateway:    http://localhost:8000`);
    console.log(`• FastAPI Docs:       http://localhost:8000/docs`);
    console.log(`• Security Telemetry: http://localhost:8000/security/stats`);
    console.log(`• ngrok Web Console:  http://127.0.0.1:4040`);
  } else {
    console.log(`⚠ ngrok tunnel started, but URL could not be auto-detected yet.`);
    console.log(`  Visit http://127.0.0.1:4040 in your browser to inspect your active ngrok URL.`);
  }
  console.log('\n(Press Ctrl+C anytime to stop all servers and ngrok)');
}

main().catch((err) => {
  console.error('Fatal launcher error:', err);
  cleanup();
});
