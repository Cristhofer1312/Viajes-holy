// netlify/functions/usuarios-list.js
// GET /api/usuarios-list — lista todos los usuarios del sistema
// Requiere: user:read (Admin y Encargado)
//
// El email vive ahora en la propia tabla usuarios (antes se enriquecía
// desde Supabase Auth). El contrato de salida no cambia.

const { query } = require('./_lib/db');
const { verificarAuth, puede, ok, error, handleOptions, fallo } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  try {
    const usuario = await verificarAuth(event);
    if (!puede(usuario, 'user:read')) return error('Sin permisos para ver usuarios', 403);

    const { rows } = await query(`
      SELECT u.id, u.nombre, u.email, u.rol, u.activo, u.creado_at, u.creado_por,
             COALESCE(c.nombre, '') AS creado_por_nombre
        FROM usuarios u
        LEFT JOIN usuarios c ON c.id = u.creado_por
       ORDER BY u.creado_at ASC`);

    return ok(rows.map(u => ({ ...u, email: u.email || '' })));
  } catch (err) {
    return fallo('usuarios-list', err);
  }
};
