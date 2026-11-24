// netlify/functions/_lib/auth.js
// Middleware de autenticación y autorización para las funciones de /api
//
// RANGO, REGLAS y puede() NO se declaran aquí: se importan de
// src/js/roles.js, que es la fuente única de verdad y se carga en el
// navegador. Aquí solo vive la verificación del JWT propio (ver token.js)
// y el manejo de respuestas HTTP.

const { AsyncLocalStorage } = require('node:async_hooks');
const { query } = require('./db');
const token = require('./token');
const contextoEvento = new AsyncLocalStorage();

function conEvento(event, fn) {
  return contextoEvento.run(event, fn);
}

function leerHeader(event, nombre) {
  const headers = (event && event.headers) || {};
  if (headers[nombre] != null) return String(headers[nombre]);
  const lower = nombre.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === lower) return String(headers[k] ?? '');
  }
  return '';
}
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
  const authHeader = leerHeader(event, 'authorization');
  const match = /^Bearer\s+(\S+)$/i.exec(authHeader);
  if (!match) throw errorHttp('Sin autorización: token requerido', 401);

  const payload = token.verificar(match[1]);
  if (!payload) throw errorHttp('Token inválido o expirado', 401);

  const { rows } = await query(`SELECT ${COLUMNAS_PERFIL} FROM usuarios WHERE id = $1`, [payload.sub]);
  const perfil = rows[0];
  if (!perfil) throw errorHttp('Usuario no registrado en el sistema', 401);
  if (perfil.sesion_version !== payload.v) throw errorHttp('Token inválido o expirado', 401);
  if (!perfil.activo) throw errorHttp('Usuario inactivo', 401);

  return { ...perfil, rango: RANGO[perfil.rol] || 0 };
}

// Errores de autenticación → 401 (no enmascarar como 500)
function esAuthError(msg) {
  return /Sin autorización|Token inválido|no registrado|inactivo/i.test(String(msg || ''));
}

// Headers base para todas las respuestas. Sin CORS_ORIGIN no se envía
// Access-Control-Allow-Origin (misma origen); si se configura una lista
// separada por comas, solo se refleja el Origin si está permitido + Vary.
const CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Posada-Id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

function origenesPermitidos() {
  const raw = String(process.env.CORS_ORIGIN || '').trim();
  if (!raw) return [];
  return raw.split(',').map((s) => s.trim()).filter((s) => s && s !== '*');
}

function corsHeaders(event) {
  const headers = { ...CORS_HEADERS };
  const permitidos = origenesPermitidos();
  if (permitidos.length > 0) {
    const ev = event || contextoEvento.getStore();
    const origin = typeof ev === 'string' ? ev.trim() : leerHeader(ev, 'origin').trim();
    headers['Vary'] = 'Origin';
    if (origin && permitidos.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
    }
  }
  return headers;
}

function extraerStatusYEvent(statusOEvent, event) {
  if (statusOEvent && typeof statusOEvent === 'object') {
    return { status: undefined, event: statusOEvent };
  }
  return { status: statusOEvent, event };
}

function ok(data, status, event) {
  const { status: st, event: ev } = extraerStatusYEvent(status, event);
  return { statusCode: st || 200, headers: corsHeaders(ev), body: JSON.stringify(data) };
}

function error(msg, status, event) {
  const { status: st, event: ev } = extraerStatusYEvent(status, event);
  return { statusCode: st || 400, headers: corsHeaders(ev), body: JSON.stringify({ error: msg }) };
}

// Manejo de preflight CORS
function handleOptions(event) {
  return { statusCode: 204, headers: corsHeaders(event), body: '' };
}

/** Error con código HTTP propio (validación de entrada → 400). */
function errorHttp(msg, status) {
  return Object.assign(new Error(msg), { status: status || 400 });
}

/**
 * Lee el cuerpo JSON de la petición. JSON mal formado o algo que no sea un
 * objeto ({…}) es un error del cliente (400), no del servidor.
 */
function leerJSON(event) {
  let datos;
  try {
    datos = JSON.parse(event.body || '{}');
  } catch (_) {
    throw errorHttp('El cuerpo de la petición no es JSON válido', 400);
  }
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) {
    throw errorHttp('Se esperaba un objeto JSON', 400);
  }
  return datos;
}

/**
 * Respuesta de error a partir de una excepción: 401 si es de auth, el código
 * propio si lo trae (400 de validación) y si no 500 genérico. El detalle de
 * un 500 (mensajes de Postgres, rutas…) solo va al log, nunca al cliente.
 */
function fallo(nombre, err, event) {
  const msg = String((err && err.message) || err || 'Error');
  if (esAuthError(msg)) return error(msg, 401, event);
  if (err && err.status >= 400 && err.status < 500) return error(msg, err.status, event);
  console.error(`[${nombre}]`, msg);
  return error('Error interno del servidor', 500, event);
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
  CORS_HEADERS, corsHeaders, conEvento, leerHeader, esAuthError, fallo, leerJSON, errorHttp,
  adminsActivosRestantes, buscarObjetivo, COLUMNAS_PERFIL,
};
