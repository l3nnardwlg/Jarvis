const http = require('http');
const fs = require('fs');
const path = require('path');
const config = require('../core/config');
const { logger } = require('../core/logger');
const { createRouter } = require('./routes');

const log = logger.child('api:server');

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const ct = req.headers['content-type'] || '';
      if (ct.includes('application/json')) {
        try { resolve(JSON.parse(body.toString())); } catch { resolve({}); }
      } else {
        resolve(body);
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, data, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(JSON.stringify(data));
}

function sendSSE(res, headers = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    ...headers,
  });
}

function serveStatic(req, res) {
  const publicDir = path.join(config.root, 'public');
  let filePath = path.join(publicDir, req.url === '/' ? 'index.html' : req.url);
  filePath = path.normalize(filePath);

  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not Found');
    return;
  }

  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': mime });
  res.end(content);
}

class APIServer {
  constructor() {
    this.server = null;
    this.router = null;
  }

  async init(engine) {
    this.engine = engine;
    this.router = createRouter(engine);

    this.server = http.createServer(async (req, res) => {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        });
        res.end();
        return;
      }

      if (req.url.startsWith('/api/')) {
        try {
          const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await parseBody(req) : null;
          await this.router(req, res, body);
        } catch (err) {
          log.error('API error', { error: err.message, url: req.url });
          sendJSON(res, { error: err.message }, 500);
        }
        return;
      }

      serveStatic(req, res);
    });

    this.server.listen(config.server.port, config.server.host, () => {
      log.info(`Jarvis API running at http://${config.server.host}:${config.server.port}`);
    });
  }

  status() {
    return { running: this.server?.listening || false, port: config.server.port };
  }

  shutdown() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(resolve);
      } else {
        resolve();
      }
    });
  }
}

module.exports = { APIServer, sendJSON, sendSSE, parseBody };
