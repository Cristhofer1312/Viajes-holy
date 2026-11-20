// netlify/functions/_lib/uploads.js
// Almacenamiento de fotos en disco (reemplaza a Supabase Storage).
//
// Archivos en  UPLOADS_DIR/<posadaId>/<archivo>  (volumen Docker)
// servidos por server.js en  /uploads/<posadaId>/<archivo>

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', '..', 'uploads'));
const URL_PREFIX = '/uploads/';
const TIPOS = { 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// Los ids de posada son slugs o UUID: nada de "/", "." ni otros caracteres
function carpetaSegura(posadaId) {
  const id = String(posadaId || '');
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/i.test(id)) return null;
  return path.join(UPLOADS_DIR, id);
}

function nombreArchivo(ext) {
  return Date.now().toString(36) + crypto.randomBytes(6).toString('hex') + '.' + ext;
}

/**
 * Comprueba que los primeros bytes correspondan al tipo declarado: impide
 * guardar como .png/.jpg algo que no es una imagen.
 */
function firmaValida(buffer, contentType) {
  const b = buffer || Buffer.alloc(0);
  const ext = TIPOS[contentType];
  if (ext === 'jpg') return b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (ext === 'png') return b.length > 8 && b.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (ext === 'webp') return b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

/** Guarda el buffer y devuelve la URL pública relativa. */
async function guardar(posadaId, buffer, contentType) {
  const ext = TIPOS[contentType];
  if (!ext) throw Object.assign(new Error('Tipo de archivo no permitido. Usar JPEG, PNG o WebP'), { status: 400 });
  if (!firmaValida(buffer, contentType)) {
    throw Object.assign(new Error('El archivo no es una imagen válida'), { status: 400 });
  }
  const dir = carpetaSegura(posadaId);
  if (!dir) throw Object.assign(new Error('posadaId inválido'), { status: 400 });
  const nombre = nombreArchivo(ext);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, nombre), buffer);
  return URL_PREFIX + path.basename(dir) + '/' + nombre;
}

/** Borra la carpeta completa de fotos de una posada. */
async function borrarPosada(posadaId) {
  const dir = carpetaSegura(posadaId);
  if (!dir) return;
  await fs.promises.rm(dir, { recursive: true, force: true });
}

/** Borra archivos sueltos a partir de sus URLs /uploads/... */
async function borrarUrls(urls) {
  for (const url of urls || []) {
    if (typeof url !== 'string' || !url.startsWith(URL_PREFIX)) continue;
    const abs = path.resolve(UPLOADS_DIR, url.slice(URL_PREFIX.length));
    if (!abs.startsWith(UPLOADS_DIR + path.sep)) continue;
    await fs.promises.rm(abs, { force: true });
  }
}

/**
 * Borra carpetas de fotos cuyo id no es una posada existente y que llevan
 * más de `horas` sin cambios: quedan cuando se suben fotos para una plantilla
 * nueva y luego no se guarda (las fotos se suben antes que la plantilla).
 */
async function barrerHuerfanas(idsExistentes, horas = 24) {
  const vivos = new Set(idsExistentes);
  const limite = Date.now() - horas * 3600 * 1000;
  let entradas = [];
  try { entradas = await fs.promises.readdir(UPLOADS_DIR, { withFileTypes: true }); } catch (_) { return 0; }
  let borradas = 0;
  for (const e of entradas) {
    if (!e.isDirectory() || vivos.has(e.name) || !carpetaSegura(e.name)) continue;
    const dir = path.join(UPLOADS_DIR, e.name);
    const st = await fs.promises.stat(dir).catch(() => null);
    if (st && st.mtimeMs < limite) { await fs.promises.rm(dir, { recursive: true, force: true }); borradas++; }
  }
  return borradas;
}

module.exports = { UPLOADS_DIR, URL_PREFIX, TIPOS, firmaValida, guardar, borrarPosada, borrarUrls, barrerHuerfanas, carpetaSegura };
