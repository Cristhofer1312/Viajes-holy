// netlify/functions/me.js
// GET /api/me — devuelve el perfil del usuario autenticado (nombre, rol, activo)

const { verificarAuth, ok, error, handleOptions } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  try {
    const usuario = await verificarAuth(event);
    return ok({
      id:        usuario.id,
      nombre:    usuario.nombre,
      rol:       usuario.rol,
      activo:    usuario.activo,
      creado_at: usuario.creado_at,
    });
  } catch (err) {
    return error(err.message, 401);
  }
};
