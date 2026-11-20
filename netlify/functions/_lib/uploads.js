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

/** Guarda el buffer y devuelve la URL pública relativa. */
async function guardar(posadaId, buffer, contentType) {
  const ext = TIPOS[contentType];
  if (!ext) throw Object.assign(new Error('Tipo de archivo no permitido. Usar JPEG, PNG o WebP'), { status: 400 });
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

module.exports = { UPLOADS_DIR, URL_PREFIX, TIPOS, guardar, borrarPosada, borrarUrls, carpetaSegura };
