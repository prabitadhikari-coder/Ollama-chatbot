/**
 * Automated Test Suite for Ollama Chatbot Backend
 * Run with: node tests/api.test.js
 */

const http = require('http');

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

function makeRequest(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log(`=======================================================`);
  console.log(`Starting Backend Verification Tests against ${BASE_URL}`);
  console.log(`=======================================================\n`);

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} - ${details}`);
      failed++;
    }
  }

  try {
    // Test 1: Health check endpoint
    console.log('--- 1. Testing GET /api/health ---');
    const healthRes = await makeRequest('/api/health');
    assert(healthRes.statusCode === 200, 'GET /api/health returns 200 OK');
    const healthJson = JSON.parse(healthRes.body);
    assert(healthJson.status === 'healthy', 'Health status is "healthy"');

    // Test 2: Ollama status check endpoint
    console.log('\n--- 2. Testing GET /api/status ---');
    const statusRes = await makeRequest('/api/status');
    assert(statusRes.statusCode === 200, 'GET /api/status returns 200 OK');
    const statusJson = JSON.parse(statusRes.body);
    assert(statusJson.connected === true, 'Ollama is connected');
    assert(statusJson.chatModelAvailable === true, `Chat model (${statusJson.chatModel}) is available in Ollama`);
    assert(statusJson.readingModelAvailable === true, `Reading model (${statusJson.readingModel}) is available in Ollama`);

    // Test 3: Input validation - Empty message
    console.log('\n--- 3. Testing POST /api/chat Input Validation ---');
    const emptyMsgRes = await makeRequest(
      '/api/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { message: '   ' }
    );
    assert(emptyMsgRes.statusCode === 400, 'Empty message returns 400 Bad Request');

    // Test 4: Input validation - Oversized message (>10,000 chars)
    const longMessage = 'A'.repeat(10005);
    const oversizedRes = await makeRequest(
      '/api/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { message: longMessage }
    );
    assert(oversizedRes.statusCode === 413, 'Oversized message (>10k chars) returns 413 Payload Too Large');

    // Test 5: Input validation - Invalid history
    const invalidHistoryRes = await makeRequest(
      '/api/chat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { message: 'Hello', history: 'not-an-array' }
    );
    assert(invalidHistoryRes.statusCode === 400, 'Non-array history returns 400 Bad Request');

    // Test 6: CORS approved origin
    console.log('\n--- 4. Testing CORS Policy ---');
    const corsApprovedRes = await makeRequest(
      '/api/health',
      {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://my-app.pages.dev',
          'Access-Control-Request-Method': 'GET',
        },
      }
    );
    assert(
      corsApprovedRes.headers['access-control-allow-origin'] === 'https://my-app.pages.dev',
      'CORS permits *.pages.dev domain'
    );

    // Test 7: CORS blocked origin
    const corsBlockedRes = await makeRequest(
      '/api/health',
      {
        method: 'GET',
        headers: {
          Origin: 'https://unauthorized-malicious-domain.com',
        },
      }
    );
    assert(
      corsBlockedRes.statusCode === 403 || !corsBlockedRes.headers['access-control-allow-origin'],
      'CORS blocks unauthorized external origin'
    );

    // Test 8: Live model generation test with Nemotron Mini
    console.log('\n--- 5. Testing Live AI Stream Generation (Chat Model: nemotron-mini) ---');
    const chatStreamRes = await makeRequest(
      '/api/chat',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
        },
      },
      { message: 'Respond with the single word "VERIFIED".', role: 'chat' }
    );
    assert(chatStreamRes.statusCode === 200, 'POST /api/chat returns 200 streaming status');
    assert(
      chatStreamRes.headers['content-type']?.includes('text/event-stream'),
      'Content-Type header is text/event-stream'
    );
    assert(
      chatStreamRes.body.includes('data:'),
      'Stream contains Server-Sent Events data chunks'
    );

    console.log(`\n=======================================================`);
    console.log(`Test Execution Complete: ${passed} Passed, ${failed} Failed`);
    console.log(`=======================================================`);

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error(`\n[ERROR] Connection refused at ${BASE_URL}.`);
      console.error('The Node.js server is not running.');
      console.error('Please start it first in another terminal with: npm start');
      process.exit(1);
    }
    console.error('Test execution failed with error:', err);
    process.exit(1);
  }
}

runTests();
