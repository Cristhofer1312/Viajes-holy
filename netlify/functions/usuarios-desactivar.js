// netlify/functions/usuarios-desactivar.js
// POST /api/usuarios-desactivar — desactiva un usuario (activo: false)
// Requiere: user:deactivate con restricción de rango + noPropio

const { supabase } = require('./_lib/supabase');
const { verificarAuth, puede, ok, error, handleOptions, RANGO } = require('./_lib/auth');

function esAuthError(msg) {
  return /Sin autorización|Token inválido|no registrado|inactivo/i.test(String(msg || ''));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  try {
    const actor = await verificarAuth(event);
    const { id } = JSON.parse(event.body || '{}');
    if (!id) return error('Falta id del usuario', 400);

    // Obtener el objetivo
    const { data: objetivo, error: getErr } = await supabase
      .from('usuarios')
      .select('id, rol, activo')
      .eq('id', id)
      .single();

    if (getErr || !objetivo) return error('Usuario no encontrado', 404);

    const objetivoConRango = { ...objetivo, rango: RANGO[objetivo.rol] || 0 };

    // puede() ya verifica noPropio (no puede desactivarse a sí mismo)
    if (!puede(actor, 'user:deactivate', objetivoConRango)) {
      return error('Sin permisos para desactivar este usuario', 403);
    }

    // Guarda: nunca dejar el sistema sin admins activos
    if (objetivo.rol === 'admin' && objetivo.activo) {
      const { count, error: countErr } = await supabase
        .from('usuarios')
        .select('id', { count: 'exact', head: true })
        .eq('rol', 'admin')
        .eq('activo', true)
        .neq('id', id);
      if (countErr) throw countErr;
      if ((count || 0) === 0) {
        return error('No se puede desactivar al único administrador activo', 409);
      }
    }

    const { error: dbErr } = await supabase
      .from('usuarios')
      .update({ activo: false })
      .eq('id', id);

    if (dbErr) throw dbErr;
    return ok({ success: true, id, activo: false });
  } catch (err) {
    console.error('[usuarios-desactivar]', err.message);
    return error(err.message, esAuthError(err.message) ? 401 : 500);
  }
};
