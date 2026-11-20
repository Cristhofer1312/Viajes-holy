// netlify/functions/auth-login.js
// POST /api/auth-login — { email, pass } → { token, usuario }
//
// Reemplaza a supabase.auth.signInWithPassword. Limita los intentos fallidos
// por IP+email para frenar ataques de fuerza bruta.

const { query } = require('./_lib/db');
const token = require('./_lib/token');
const { ok, error, handleOptions, RANGO } = require('./_lib/auth');

const MAX_INTENTOS = 10;
const VENTANA_MS = 15 * 60 * 1000;
const intentos = new Map(); // clave → { n, desde }

function clave(event, email) {
  const xff = String(event.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return (xff || event.headers['x-real-ip'] || 'local') + '|' + email;
}

function bloqueado(k) {
  const r = intentos.get(k);
  if (!r) return false;
  if (Date.now() - r.desde > VENTANA_MS) { intentos.delete(k); return false; }
  return r.n >= MAX_INTENTOS;
}

function registrarFallo(k) {
  const r = intentos.get(k);
  if (!r || Date.now() - r.desde > VENTANA_MS) intentos.set(k, { n: 1, desde: Date.now() });
  else r.n++;
  if (intentos.size > 10000) intentos.clear(); // tope de memoria
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'POST') return error('Método no permitido', 405);

  try {
    const body = JSON.parse(event.body || '{}');
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const pass = typeof body.pass === 'string' ? body.pass : '';
    if (!email || !pass) return error('Credenciales inválidas', 401);

    const k = clave(event, email);
    if (bloqueado(k)) return error('Demasiados intentos. Espera unos minutos.', 429);

    const { rows } = await query(
      'SELECT id, email, nombre, rol, activo, sesion_version, password_hash FROM usuarios WHERE lower(email) = $1',
      [email]
    );
    const u = rows[0];
    const valido = await token.compararPassword(pass, u ? u.password_hash : token.hashParaComparacionCiega());
    if (!u || !valido) {
      registrarFallo(k);
      return error('Credenciales inválidas', 401);
    }
    if (!u.activo) return error('Usuario inactivo', 403);

    intentos.delete(k);
    return ok({
      token: token.emitir(u),
      expiraEnHoras: token.EXPIRA_HORAS,
      usuario: { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol, activo: u.activo, rango: RANGO[u.rol] || 0 },
    });
  } catch (err) {
    console.error('[auth-login]', err.message);
    return error('Error iniciando sesión', 500);
  }
};
