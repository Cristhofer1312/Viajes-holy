// netlify/functions/_lib/auth.js
// Middleware de autenticación y autorización para las Netlify Functions
//
// RANGO, REGLAS y puede() NO se declaran aquí: se importan de
// src/js/roles.js, que es la fuente única de verdad y se carga en el
// navegador. Solo vive en este archivo el código que necesita el SDK de
// Supabase (verificarAuth) y el manejo de respuestas HTTP.

const { supabase } = require('./supabase');
let Roles = { RANGO: {}, REGLAS: {}, puede: () => false };
try {
  Roles = require('../../../src/js/roles.js');
} catch (e) {
  console.error('Error cargando roles.js:', e);
}

const RANGO = Roles.RANGO;
const puede = Roles.puede;

// Verifica el JWT del header Authorization y devuelve el perfil del usuario
async function verificarAuth(event) {
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) throw new Error('Sin autorización: token requerido');

  // Verificar JWT con Supabase Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) throw new Error('Token inválido o expirado');

  // Obtener perfil con rol de la tabla usuarios
  const { data: perfil, error: perfilError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', user.id)
    .single();

  if (perfilError || !perfil) throw new Error('Usuario no registrado en el sistema');
  if (!perfil.activo) throw new Error('Usuario inactivo');

  return { ...perfil, rango: RANGO[perfil.rol] || 0 };
}

// Headers CORS comunes para todas las respuestas
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

module.exports = { verificarAuth, puede, RANGO, REGLAS: Roles.REGLAS, ok, error, handleOptions, CORS_HEADERS };
