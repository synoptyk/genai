#!/usr/bin/env node
/**
 * Quick Health Check Script
 * Verifica que el servidor inicia correctamente con las nuevas mejoras
 */

const http = require('http');

const PORT = process.env.PORT || 5003;
const BASE_URL = `http://localhost:${PORT}`;

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const log = (color, message) => {
  console.log(`${color}${message}${colors.reset}`);
};

const makeRequest = (path, timeout = 5000) => {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            data: JSON.parse(data),
            headers: res.headers,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            headers: res.headers,
          });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(timeout, () => {
      req.destroy();
      reject(new Error('Timeout'));
    });
  });
};

const runTests = async () => {
  log(colors.blue, '\n🧪 Running Health Check Tests...\n');
  
  const tests = [
    {
      name: 'Ping Platform',
      path: '/api/ping-platform',
      expectStatus: 200,
    },
    {
      name: 'Health Check (Basic)',
      path: '/api/health',
      expectStatus: 200,
    },
    {
      name: 'Health Check (Detailed)',
      path: '/api/health/detailed',
      expectStatus: 200,
    },
    {
      name: 'Health Check (Metrics)',
      path: '/api/health/metrics',
      expectStatus: 200,
    },
    {
      name: 'Health Check (Ping)',
      path: '/api/health/ping',
      expectStatus: 200,
    },
  ];
  
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const response = await makeRequest(test.path);
      
      if (response.status === test.expectStatus) {
        log(colors.green, `✅ PASS: ${test.name}`);
        log(colors.blue, `   Status: ${response.status}`);
        passed++;
      } else {
        log(colors.red, `❌ FAIL: ${test.name}`);
        log(colors.yellow, `   Expected: ${test.expectStatus}, Got: ${response.status}`);
        failed++;
      }
    } catch (error) {
      log(colors.red, `❌ ERROR: ${test.name}`);
      log(colors.yellow, `   ${error.message}`);
      failed++;
    }
  }
  
  log(colors.blue, '\n' + '='.repeat(50));
  log(colors.blue, `Results: ${passed} passed, ${failed} failed`);
  
  if (failed === 0) {
    log(colors.green, '\n🎉 All tests passed! Server is healthy.\n');
    process.exit(0);
  } else {
    log(colors.red, '\n⚠️  Some tests failed. Check server logs.\n');
    process.exit(1);
  }
};

// Wait a bit for server to be ready
setTimeout(runTests, 2000);
