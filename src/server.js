'use strict';

const http = require('node:http');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);

  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store'
  });

  response.end(body);
}

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    return sendJson(response, 200, {
      status: 'ok',
      service: 'live-ia-tiktok-connector',
      timestamp: new Date().toISOString()
    });
  }

  if (request.method === 'GET' && request.url === '/') {
    return sendJson(response, 200, {
      status: 'ok',
      service: 'live-ia-tiktok-connector'
    });
  }

  sendJson(response, 404, {
    error: 'Not Found'
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Live IA TikTok Connector rodando na porta ${PORT}`);
});
