// netlify/functions/usuarios-update.js
// PUT /api/usuarios-update — actualiza nombre y/o rol de un usuario
//
// Requiere: user:create-equivalente `user:update` (solo Admin), nunca sobre
// sí mismo (noPropio) y sin poder promover a admin (regla `asigna`).

const { supabase } = require('./_lib/supabase');
const { verificarAuth, puede, ok, error, handleOptions } = require('./_lib/auth');

function esAuthError(msg) {
  return /Sin autorización|Token inválido|no registrado|inactivo/i.test(String(msg || ''));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  try {
    const actor = await verificarAuth(event);

    const { id, nombre, rol } = JSON.parse(event.body || '{}');
    if (!id) return error('Falta id del usuario', 400);
    if (rol && !['admin', 'encargado', 'agente'].includes(rol)) return error('Rol inválido', 400);

    // El objetivo debe existir: sus datos actuales son los que se evalúan
    const { data: objetivo, error: getErr } = await supabase
      .from('usuarios')
      .select('id, rol, activo')
      .eq('id', id)
      .single();

    if (getErr || !objetivo) return error('Usuario no encontrado', 404);

    // noPropio + anti-escalación (no puede editarse a sí mismo ni promover a admin)
    if (!puede(actor, 'user:update', { ...objetivo, rol: rol || objetivo.rol })) {
      return error('Sin permisos para editar este usuario', 403);
    }

    const updates = {};
    if (typeof nombre === 'string' && nombre.trim()) updates.nombre = nombre.trim();
    if (rol) updates.rol = rol;
    if (!Object.keys(updates).length) return error('Nada que actualizar', 400);

    const { error: dbErr } = await supabase
      .from('usuarios')
      .update(updates)
      .eq('id', id);

    if (dbErr) throw dbErr;
    return ok({ success: true, id, updates });
  } catch (err) {
    console.error('[usuarios-update]', err.message);
    return error(err.message, esAuthError(err.message) ? 401 : 500);
  }
};
