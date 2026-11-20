// netlify/functions/usuarios-activar.js
// POST /api/usuarios-activar — activa un usuario (activo: true)
// Requiere: user:activate con restricción de rango jerárquico

const { query } = require('./_lib/db');
const { verificarAuth, puede, ok, error, handleOptions, fallo, buscarObjetivo } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  try {
    const actor = await verificarAuth(event);
    const { id } = JSON.parse(event.body || '{}');
    if (!id) return error('Falta id del usuario', 400);

    // El objetivo incluye su rango para que puede() evalúe la jerarquía
    const objetivo = await buscarObjetivo(id);
    if (!objetivo) return error('Usuario no encontrado', 404);

    if (!puede(actor, 'user:activate', objetivo)) {
      return error('Sin permisos para activar este usuario (revisa la jerarquía de roles)', 403);
    }

    await query('UPDATE usuarios SET activo = true WHERE id = $1', [id]);
    return ok({ success: true, id, activo: true });
  } catch (err) {
    return fallo('usuarios-activar', err);
  }
};
