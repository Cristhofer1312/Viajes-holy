// netlify/functions/auth-login.js
// POST /api/auth-login — { email, pass } → { token, usuario }
//
// Reemplaza a supabase.auth.signInWithPassword. Limita los intentos fallidos
// por IP+email, por IP y por email normalizado para frenar fuerza bruta.

const { query } = require('./_lib/db');
const token = require('./_lib/token');
const { ok, error, handleOptions, RANGO, leerJSON, leerHeader } = require('./_lib/auth');

const MAX_INTENTOS = 10;       // por IP|email
const MAX_INTENTOS_IP = 30;    // por IP (frena ataques a múltiples cuentas)
const MAX_INTENTOS_EMAIL = 20; // por email normalizado (frena ataques distribuidos)
const VENTANA_MS = 15 * 60 * 1000;
const MAX_ENTRADAS = 10000;
const MAX_BODY_BYTES = 4096;

const intentos = new Map();      // IP|email → { n, desde }
const intentosIp = new Map();    // IP → { n, desde }
const intentosEmail = new Map(); // email normalizado → { n, desde }

function normalizarEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

function obtenerIp(event) {
  const realIp = leerHeader(event, 'x-real-ip').trim();
  if (realIp) return realIp;
  const xff = leerHeader(event, 'x-forwarded-for')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (xff.length) return xff[xff.length - 1];
  return 'local';
}

function clave(event, email) {
  return obtenerIp(event) + '|' + normalizarEmail(email);
}

function podarMapa(mapa, ahora, maxEntradas = MAX_ENTRADAS) {
  for (const [k, r] of mapa) {
    if (ahora - r.desde > VENTANA_MS) mapa.delete(k);
  }
  if (mapa.size > maxEntradas) {
    const sobrantes = mapa.size - maxEntradas;
    let borrados = 0;
    for (const k of mapa.keys()) {
      mapa.delete(k);
      if (++borrados >= sobrantes) break;
    }
  }
}

function bloqueadoEn(mapa, k, max, ahora = Date.now()) {
  const r = mapa.get(k);
  if (!r) return false;
  if (ahora - r.desde > VENTANA_MS) { mapa.delete(k); return false; }
  return r.n >= max;
}

function registrarFalloEn(mapa, k, ahora = Date.now(), maxEntradas = MAX_ENTRADAS) {
  const r = mapa.get(k);
  if (!r || ahora - r.desde > VENTANA_MS) {
    mapa.delete(k); // re-insertar al final para mantener orden por antigüedad
    mapa.set(k, { n: 1, desde: ahora });
  } else {
    r.n++;
  }
  if (mapa.size > maxEntradas) podarMapa(mapa, ahora, maxEntradas);
}

function estaBloqueado(k, ip, email, ahora = Date.now()) {
  return (
    bloqueadoEn(intentos, k, MAX_INTENTOS, ahora) ||
    bloqueadoEn(intentosIp, ip, MAX_INTENTOS_IP, ahora) ||
    bloqueadoEn(intentosEmail, email, MAX_INTENTOS_EMAIL, ahora)
  );
}

function registrarFallos(k, ip, email, ahora = Date.now()) {
  registrarFalloEn(intentos, k, ahora);
  registrarFalloEn(intentosIp, ip, ahora);
  registrarFalloEn(intentosEmail, email, ahora);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions(event);
  if (event.httpMethod !== 'POST') return error('Método no permitido', 405, event);

  try {
    if (typeof event.body === 'string' && Buffer.byteLength(event.body, 'utf8') > MAX_BODY_BYTES) {
      return error('Payload demasiado grande', 413, event);
    }

    const body = leerJSON(event);
    const email = normalizarEmail(body.email);
    const pass = typeof body.pass === 'string' ? body.pass : '';
    const ip = obtenerIp(event);

    if (!email || !pass) {
      if (bloqueadoEn(intentosIp, ip, MAX_INTENTOS_IP)) {
        return error('Demasiados intentos. Espera unos minutos.', 429, event);
      }
      return error('Credenciales inválidas', 401, event);
    }

    const k = clave(event, email);
    if (estaBloqueado(k, ip, email)) {
      return error('Demasiados intentos. Espera unos minutos.', 429, event);
    }

    if (token.excedeMaxPassword(pass)) {
      registrarFallos(k, ip, email);
      return error('Credenciales inválidas', 401, event);
    }

    const { rows } = await query(
      'SELECT id, email, nombre, rol, activo, sesion_version, password_hash FROM usuarios WHERE lower(email) = $1',
      [email]
    );
    const u = rows[0];
    const valido = await token.compararPassword(pass, u ? u.password_hash : token.hashParaComparacionCiega());
    if (!u || !valido || !u.activo) {
      registrarFallos(k, ip, email);
      return error('Credenciales inválidas', 401, event);
    }

    intentos.delete(k);
    intentosEmail.delete(email);
    return ok({
      token: token.emitir(u),
      expiraEnHoras: token.EXPIRA_HORAS,
      usuario: { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol, activo: u.activo, rango: RANGO[u.rol] || 0 },
    }, 200, event);
  } catch (err) {
    if (err.status === 400) return error(err.message, 400, event);
    console.error('[auth-login]', err.message);
    return error('Error iniciando sesión', 500, event);
  }
};

exports._interno = {
  clave,
  obtenerIp,
  podarMapa,
  bloqueadoEn,
  registrarFalloEn,
  intentos,
  intentosIp,
  intentosEmail,
  MAX_INTENTOS,
  MAX_INTENTOS_IP,
  MAX_INTENTOS_EMAIL,
  VENTANA_MS,
  MAX_ENTRADAS,
  MAX_BODY_BYTES,
};
