// netlify/functions/usuarios-update.js
// PUT /api/usuarios-update — actualiza nombre y/o rol de un usuario
//
// Requiere: `user:update` (solo Admin), nunca sobre sí mismo (noPropio) y
// sin poder promover a admin (regla `asigna`).

const { query } = require('./_lib/db');
const { verificarAuth, puede, ok, error, handleOptions, fallo, buscarObjetivo } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  try {
    const actor = await verificarAuth(event);

    const { id, nombre, rol } = JSON.parse(event.body || '{}');
    if (!id) return error('Falta id del usuario', 400);
    if (rol && !['admin', 'encargado', 'agente'].includes(rol)) return error('Rol inválido', 400);

    // El objetivo debe existir: sus datos actuales son los que se evalúan
    const objetivo = await buscarObjetivo(id);
    if (!objetivo) return error('Usuario no encontrado', 404);

    // noPropio + anti-escalación (no puede editarse a sí mismo ni promover a admin)
    if (!puede(actor, 'user:update', { ...objetivo, rol: rol || objetivo.rol })) {
      return error('Sin permisos para editar este usuario', 403);
    }

    const updates = {};
    if (typeof nombre === 'string' && nombre.trim()) updates.nombre = nombre.trim();
    if (rol) updates.rol = rol;
    if (!Object.keys(updates).length) return error('Nada que actualizar', 400);

    await query(
      'UPDATE usuarios SET nombre = COALESCE($2, nombre), rol = COALESCE($3, rol) WHERE id = $1',
      [id, updates.nombre || null, updates.rol || null]
    );
    return ok({ success: true, id, updates });
  } catch (err) {
    return fallo('usuarios-update', err);
  }
};
