// netlify/functions/_lib/auth.js
// Middleware de autenticación y autorización para las funciones de /api
//
// RANGO, REGLAS y puede() NO se declaran aquí: se importan de
// src/js/roles.js, que es la fuente única de verdad y se carga en el
// navegador. Aquí solo vive la verificación del JWT propio (ver token.js)
// y el manejo de respuestas HTTP.

const { query } = require('./db');
const token = require('./token');
let Roles = { RANGO: {}, REGLAS: {}, puede: () => false };
try {
  Roles = require('../../../src/js/roles.js');
} catch (e) {
  console.error('Error cargando roles.js:', e);
}

const RANGO = Roles.RANGO;
const puede = Roles.puede;

// Columnas públicas del perfil (nunca password_hash)
const COLUMNAS_PERFIL = 'id, email, nombre, rol, activo, sesion_version, creado_at, creado_por';

// Verifica el JWT del header Authorization y devuelve el perfil del usuario
async function verificarAuth(event) {
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) throw new Error('Sin autorización: token requerido');

  const payload = token.verificar(jwt);
  if (!payload) throw new Error('Token inválido o expirado');

  const { rows } = await query(`SELECT ${COLUMNAS_PERFIL} FROM usuarios WHERE id = $1`, [payload.sub]);
  const perfil = rows[0];
  if (!perfil) throw new Error('Usuario no registrado en el sistema');
  if (perfil.sesion_version !== payload.v) throw new Error('Token inválido o expirado');
  if (!perfil.activo) throw new Error('Usuario inactivo');

  return { ...perfil, rango: RANGO[perfil.rol] || 0 };
}

// Errores de autenticación → 401 (no enmascarar como 500)
function esAuthError(msg) {
  return /Sin autorización|Token inválido|no registrado|inactivo/i.test(String(msg || ''));
}

// Headers CORS comunes para todas las respuestas.
// En el VPS el frontend y la API comparten origen, así que CORS_ORIGIN puede
// fijarse al dominio (https://midominio.com). Sin definir → '*'.
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Posada-Id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

function ok(data, status) {
  return { statusCode: status || 200, headers: CORS_HEADERS, body: JSON.stringify(data) };
}

function error(msg, status) {
  return { statusCode: status || 400, headers: CORS_HEADERS, body: JSON.stringify({ error: msg }) };
}

// Manejo de preflight CORS
function handleOptions() {
  return { statusCode: 204, headers: CORS_HEADERS, body: '' };
}

/** Respuesta de error a partir de una excepción: 401 si es de auth, si no 500. */
function fallo(nombre, err) {
  const msg = String((err && err.message) || err || 'Error');
  if (esAuthError(msg)) return error(msg, 401);
  console.error(`[${nombre}]`, msg);
  return error(msg, 500);
}

/** Cuenta los admins activos excluyendo `idExcluido` (guardas de "último admin"). */
async function adminsActivosRestantes(idExcluido) {
  const { rows } = await query(
    "SELECT count(*)::int AS n FROM usuarios WHERE rol = 'admin' AND activo AND id <> $1",
    [idExcluido]
  );
  return rows[0].n;
}

/** Busca un usuario por id con las columnas necesarias para evaluar permisos. */
async function buscarObjetivo(id) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) return null;
  const { rows } = await query('SELECT id, rol, activo FROM usuarios WHERE id = $1', [id]);
  return rows[0] ? { ...rows[0], rango: RANGO[rows[0].rol] || 0 } : null;
}

module.exports = {
  verificarAuth, puede, RANGO, REGLAS: Roles.REGLAS, ok, error, handleOptions,
  CORS_HEADERS, esAuthError, fallo, adminsActivosRestantes, buscarObjetivo, COLUMNAS_PERFIL,
};
