const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const axios = require('axios');

// This file adapts the backend proxy server to work as a Netlify Function. It
// mirrors the logic in `backend/server.js` but exports a handler for
// serverless environments instead of starting a local server.

const app = express();

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'Youtube Go Proxy Server (Netlify)',
    endpoints: {
      proxy: '/proxy?url=TARGET_URL',
      health: '/health'
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/proxy', async (req, res) => {
  try {
    const targetUrl = req.query.url;

    if (!targetUrl) {
      return res.status(400).json({
        error: 'URL parameter is required',
        usage: '/proxy?url=https://example.com'
      });
    }

    console.log(`Proxying request to: ${targetUrl}`);

    const response = await axios.get(targetUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        Referer: new URL(targetUrl).origin
      },
      validateStatus: () => true,
      maxRedirects: 5,
      timeout: 30000
    });

    const headers = { ...response.headers };
    delete headers['x-frame-options'];
    delete headers['content-security-policy'];
    delete headers['content-security-policy-report-only'];
    delete headers['cross-origin-opener-policy'];
    delete headers['cross-origin-embedder-policy'];

    res.set({
      ...headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'X-Frame-Options': 'ALLOWALL'
    });

    res.status(response.status).send(response.data);
    console.log(`✓ Successfully proxied ${targetUrl} (${response.status})`);
  } catch (error) {
    console.error('Proxy error:', error.message);
    res.status(500).json({
      error: 'Proxy request failed',
      message: error.message
    });
  }
});

app.post('/proxy', async (req, res) => {
  try {
    const { url, method = 'GET', headers = {}, body = null } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required in request body' });
    }

    console.log(`Proxying ${method} request to: ${url}`);

    const response = await axios({
      method,
      url,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        ...headers
      },
      data: body,
      validateStatus: () => true,
      maxRedirects: 5,
      timeout: 30000
    });

    const responseHeaders = { ...response.headers };
    delete responseHeaders['x-frame-options'];
    delete responseHeaders['content-security-policy'];

    res.set({
      ...responseHeaders,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*'
    });

    res.status(response.status).send(response.data);
  } catch (error) {
    console.error('POST proxy error:', error.message);
    res.status(500).json({
      error: 'Proxy request failed',
      message: error.message
    });
  }
});

app.options('*', cors());

// Instead of starting a server, export the handler for Netlify.
module.exports.handler = serverless(app);
