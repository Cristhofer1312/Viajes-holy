// server.js
// Servidor de desarrollo local ligero.
// Reemplaza a netlify-cli porque netlify tiene bugs en Windows con Node 24.
// Este servidor sirve los archivos estáticos de /src y simula las Netlify Functions de /api

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8888;
const SRC_DIR = path.join(__dirname, 'src');
const API_PREFIX = '/api/';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2'
};

const SKIP_404_LOG = new Set(['/favicon.ico', '/mcp/', '/mcp', '/sse']);

const server = http.createServer((req, res) => {
  try {
    // Decodificar la URL para manejar espacios y caracteres especiales (%20, etc.)
    const decodedUrl = decodeURIComponent(req.url);

    // 1. Manejo de Rutas de la API (simula Netlify Functions)
    if (decodedUrl.startsWith(API_PREFIX)) {
      const funcName = decodedUrl.slice(API_PREFIX.length).split('?')[0];
      const funcPath = path.join(__dirname, 'netlify', 'functions', funcName + '.js');
      
      if (!fs.existsSync(funcPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Function ${funcName} not found` }));
        return;
      }
      
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        const event = {
          httpMethod: req.method,
          headers: req.headers,
          body: body || null,
          queryStringParameters: Object.fromEntries(new URL(req.url, `http://${req.headers.host}`).searchParams)
        };
        
        try {
          // Limpiar caché para poder editar las funciones sin reiniciar el servidor
          delete require.cache[require.resolve(funcPath)];
          const func = require(funcPath);
          const response = await func.handler(event);
          
          res.writeHead(response.statusCode || 200, response.headers || { 'Content-Type': 'application/json' });
          res.end(response.body);
        } catch (err) {
          console.error(`[API Error - ${funcName}]`, err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      });
      return;
    }

    // 2. Servir archivos estáticos (Frontend)
    const urlPath = decodedUrl.split('?')[0];
    let filePath = path.join(SRC_DIR, urlPath === '/' ? 'index.html' : urlPath);
    
    // Si no existe, probar añadiendo .html
    if (!fs.existsSync(filePath)) {
        if (fs.existsSync(filePath + '.html')) {
            filePath += '.html';
        } else {
            if (!SKIP_404_LOG.has(urlPath)) {
              console.warn(`[404] ${urlPath}`);
            }
            res.writeHead(404);
            res.end('Not found');
            return;
        }
    }

    const ext = path.extname(filePath).toLowerCase();
    const MIME = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.woff': 'font/woff',
      '.woff2': 'font/woff2',
      '.ttf': 'font/ttf',
      '.ico': 'image/x-icon',
    };
    const contentType = MIME[ext] || 'application/octet-stream';
    
    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Error loading static file');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  } catch (err) {
    console.error(err);
    res.writeHead(500);
    res.end('Server Error');
  }
});


server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 SERVIDOR LOCAL LISTO Y LIBRE DE ERRORES`);
  console.log(`======================================================`);
  console.log(`👉 Panel Admin: http://localhost:${PORT}/admin.html`);
  console.log(`👉 Cotizador:   http://localhost:${PORT}/index.html`);
  console.log(`======================================================\n`);
});
