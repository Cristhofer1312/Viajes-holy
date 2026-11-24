// server.js
// Servidor HTTP de la app: sirve los archivos estáticos de /src y ejecuta las
// funciones de netlify/functions bajo /api/* (mismo contrato que Netlify:
// handler(event) → { statusCode, headers, body }).
//
// Se usa igual en desarrollo (`node server.js`) y en producción en el VPS
// (Docker, detrás de nginx). El modo lo decide NODE_ENV:
//   - development (por defecto): sin caché y recarga las funciones en cada
//     petición para poder editarlas sin reiniciar.
//   - production: caché HTTP para los assets y funciones cargadas una sola vez.
//
// Variables de entorno: PORT (8888), HOST (0.0.0.0), NODE_ENV,
// MAX_BODY_MB (25), UPLOADS_DIR (./uploads), DATABASE_URL, JWT_SECRET
// (ver .env.example).

require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');

const PROD = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 8888;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY = (Number(process.env.MAX_BODY_MB) || 25) * 1024 * 1024;

const SRC_DIR = path.join(__dirname, 'src');
const FUNCTIONS_DIR = path.join(__dirname, 'netlify', 'functions');
const API_PREFIX = '/api/';
// Solo nombres simples: impide invocar _lib/* o salir del directorio con ../
const FUNC_NAME_RE = /^[a-z0-9][a-z0-9-]*$/i;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
};

const SKIP_404_LOG = new Set(['/favicon.ico', '/mcp/', '/mcp', '/sse']);

function sendJSON(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

// ─── API ─────────────────────────────────────────────────────────────────────

const handlerCache = new Map();

function cargarHandler(funcPath) {
  if (PROD && handlerCache.has(funcPath)) return handlerCache.get(funcPath);
  if (!PROD) delete require.cache[require.resolve(funcPath)];
  const handler = require(funcPath).handler;
  if (PROD) handlerCache.set(funcPath, handler);
  return handler;
}

function manejarApi(req, res, url) {
  const funcName = url.pathname.slice(API_PREFIX.length).replace(/\/+$/, '');
  if (!FUNC_NAME_RE.test(funcName)) {
    return sendJSON(res, 404, { error: 'Function not found' });
  }
  const funcPath = path.join(FUNCTIONS_DIR, funcName + '.js');
  if (!fs.existsSync(funcPath)) {
    return sendJSON(res, 404, { error: `Function ${funcName} not found` });
  }

  const chunks = [];
  let size = 0;
  let abortado = false;
  req.on('data', (chunk) => {
    if (abortado) return;
    size += chunk.length;
    if (size > MAX_BODY) {
      abortado = true;
      sendJSON(res, 413, { error: 'Payload demasiado grande' });
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });
  req.on('end', async () => {
    if (abortado) return;
    const raw = Buffer.concat(chunks);
    // Igual que Netlify: los cuerpos binarios (imágenes) llegan en base64
    const tipo = String(req.headers['content-type'] || '').toLowerCase();
    const binario = /^(image|application\/octet-stream)/.test(tipo);
    const body = raw.length ? raw.toString(binario ? 'base64' : 'utf8') : null;
    const event = {
      httpMethod: req.method,
      path: url.pathname,
      headers: req.headers,
      body,
      isBase64Encoded: binario,
      queryStringParameters: Object.fromEntries(url.searchParams),
    };
    try {
      const handler = cargarHandler(funcPath);
      const { conEvento } = require('./netlify/functions/_lib/auth');
      const response = (await conEvento(event, () => handler(event))) || {};
      res.writeHead(response.statusCode || 200,
        response.headers || { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(response.body || '');
    } catch (err) {
      console.error(`[API Error - ${funcName}]`, err);
      if (!res.headersSent) sendJSON(res, 500, { error: 'Internal Server Error' });
    }
  });
}

// ─── Estáticos ───────────────────────────────────────────────────────────────

// Fotos subidas por los usuarios (volumen Docker), servidas en /uploads/*
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, 'uploads'));
const UPLOADS_PREFIX = '/uploads/';

function resolverEstatico(urlPath) {
  let base = SRC_DIR;
  let rel = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const esUpload = urlPath.startsWith(UPLOADS_PREFIX);
  if (esUpload) {
    base = UPLOADS_DIR;
    rel = urlPath.slice(UPLOADS_PREFIX.length);
  }
  const filePath = path.resolve(base, rel);
  // Impide salir del directorio base (path traversal)
  if (filePath !== base && !filePath.startsWith(base + path.sep)) return null;

  const candidatos = esUpload
    ? [filePath]
    : [filePath, filePath + '.html', path.join(filePath, 'index.html')];
  for (const c of candidatos) {
    try {
      if (fs.statSync(c).isFile()) return c;
    } catch (_) { /* no existe */ }
  }
  return null;
}

function cacheControl(ext, tieneVersion) {
  if (!PROD) {
    return ['.html', '.js', '.css'].includes(ext) ? 'no-store, must-revalidate' : null;
  }
  // El HTML siempre se revalida para que los ?v=N nuevos lleguen al navegador
  if (ext === '.html') return 'no-cache';
  // Recursos versionados (?v=N) o fuentes: caché larga
  if (tieneVersion || ext === '.woff2' || ext === '.woff' || ext === '.ttf') {
    return 'public, max-age=31536000, immutable';
  }
  return 'public, max-age=3600';
}

function manejarEstatico(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  const filePath = resolverEstatico(url.pathname);
  if (!filePath) {
    if (!SKIP_404_LOG.has(url.pathname)) console.warn(`[404] ${url.pathname}`);
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'X-Content-Type-Options': 'nosniff',
  };
  // Los nombres de archivo subidos son únicos e inmutables → caché larga
  const cc = cacheControl(ext, url.searchParams.has('v') || url.pathname.startsWith(UPLOADS_PREFIX));
  if (cc) headers['Cache-Control'] = cc;

  const stream = fs.createReadStream(filePath);
  stream.on('open', () => {
    res.writeHead(200, headers);
    if (req.method === 'HEAD') { stream.destroy(); res.end(); return; }
    stream.pipe(res);
  });
  stream.on('error', (err) => {
    console.error('[static]', err.message);
    if (!res.headersSent) { res.writeHead(500); }
    res.end('Error loading static file');
  });
}

// ─── Servidor ────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  let url, pathname;
  try {
    url = new URL(req.url, 'http://localhost');
    // Decodificar para manejar espacios y caracteres especiales (%20, etc.)
    pathname = decodeURIComponent(url.pathname);
  } catch (err) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  const ctx = { pathname, searchParams: url.searchParams };

  try {
    if (pathname === '/healthz') return sendJSON(res, 200, { ok: true });
    if (pathname.startsWith(API_PREFIX)) return manejarApi(req, res, ctx);
    return manejarEstatico(req, res, ctx);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end('Server Error');
  }
});

if (!process.env.DATABASE_URL) {
  console.error('⚠️  Falta DATABASE_URL: la API no funcionará.');
}
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('⚠️  Falta JWT_SECRET (mínimo 32 caracteres): el login no funcionará.');
}

server.listen(PORT, HOST, () => {
  console.log(`Viajes Holy escuchando en http://${HOST}:${PORT} (${PROD ? 'production' : 'development'})`);
  if (!PROD) {
    console.log(`👉 Cotizador: http://localhost:${PORT}/index.html`);
  }
});

// Apagado limpio (docker stop envía SIGTERM)
function apagar(signal) {
  console.log(`${signal} recibido, cerrando servidor…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on('SIGTERM', () => apagar('SIGTERM'));
process.on('SIGINT', () => apagar('SIGINT'));
