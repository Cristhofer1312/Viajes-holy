// netlify/functions/_lib/token.js
// JWT HS256 mínimo con node:crypto (sin dependencias) + hash de contraseñas.
//
// Payload: { sub: <usuario.id>, v: <sesion_version>, iat, exp }
// Al cambiar/restablecer la contraseña se incrementa usuarios.sesion_version,
// lo que invalida todos los tokens emitidos antes.

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const EXPIRA_HORAS = Number(process.env.JWT_EXPIRES_HOURS) || 168; // 7 días
const BCRYPT_COST = 10;

function secreto() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET no configurado (mínimo 32 caracteres)');
  }
  return s;
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function firmar(datos) {
  return crypto.createHmac('sha256', secreto()).update(datos).digest('base64url');
}

function emitir(usuario) {
  const ahora = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64url(JSON.stringify({
    sub: usuario.id,
    v: usuario.sesion_version,
    iat: ahora,
    exp: ahora + EXPIRA_HORAS * 3600,
  }));
  return `${header}.${payload}.${firmar(header + '.' + payload)}`;
}

/** Devuelve el payload si la firma y la expiración son válidas; si no, null. */
function verificar(token) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) return null;
  const [h, p, firma] = partes;
  const esperada = Buffer.from(firmar(h + '.' + p));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) {
    return null;
  }
  try {
    const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
    if (header.alg !== 'HS256') return null;
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    if (!payload.sub || typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch (_) {
    return null;
  }
}

function hashPassword(pass) {
  return bcrypt.hash(pass, BCRYPT_COST);
}

/** Compatible con los hashes $2a$ que exporta Supabase Auth. */
function compararPassword(pass, hash) {
  if (typeof hash !== 'string' || !/^\$2[aby]\$\d\d\$.{53}$/.test(hash)) return Promise.resolve(false);
  return bcrypt.compare(pass, hash).catch(() => false);
}

// Hash real de una cadena aleatoria: se compara contra él cuando el email no
// existe, para que la respuesta tarde lo mismo y no revele qué emails hay.
let hashFicticio = null;
function hashParaComparacionCiega() {
  if (!hashFicticio) hashFicticio = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_COST);
  return hashFicticio;
}

module.exports = { emitir, verificar, hashPassword, compararPassword, hashParaComparacionCiega, EXPIRA_HORAS };
