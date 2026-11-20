// netlify/functions/usuarios-desactivar.js
// POST /api/usuarios-desactivar — desactiva un usuario (activo: false)
// Requiere: user:deactivate con restricción de rango + noPropio
//
// Efecto inmediato: verificarAuth rechaza a los usuarios inactivos en cada
// petición, así que su sesión deja de funcionar al instante.

const { query } = require('./_lib/db');
const {
  verificarAuth, puede, ok, error, handleOptions, fallo, buscarObjetivo, adminsActivosRestantes,
} = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  try {
    const actor = await verificarAuth(event);
    const { id } = JSON.parse(event.body || '{}');
    if (!id) return error('Falta id del usuario', 400);

    const objetivo = await buscarObjetivo(id);
    if (!objetivo) return error('Usuario no encontrado', 404);

    // puede() ya verifica noPropio (no puede desactivarse a sí mismo)
    if (!puede(actor, 'user:deactivate', objetivo)) {
      return error('Sin permisos para desactivar este usuario', 403);
    }

    // Guarda: nunca dejar el sistema sin admins activos
    if (objetivo.rol === 'admin' && objetivo.activo) {
      if ((await adminsActivosRestantes(id)) === 0) {
        return error('No se puede desactivar al único administrador activo', 409);
      }
    }

    await query('UPDATE usuarios SET activo = false WHERE id = $1', [id]);
    return ok({ success: true, id, activo: false });
  } catch (err) {
    return fallo('usuarios-desactivar', err);
  }
};
