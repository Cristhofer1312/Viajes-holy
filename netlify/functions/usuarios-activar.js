// netlify/functions/usuarios-activar.js
// POST /api/usuarios-activar — activa un usuario (activo: true)
// Requiere: user:activate con restricción de rango jerárquico

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

    // Obtener el objetivo para verificar la jerarquía de rango
    const { data: objetivo, error: getErr } = await supabase
      .from('usuarios')
      .select('id, rol, activo')
      .eq('id', id)
      .single();

    if (getErr || !objetivo) return error('Usuario no encontrado', 404);

    // Adjuntar rango al objetivo para que puede() lo evalúe
    const objetivoConRango = { ...objetivo, rango: RANGO[objetivo.rol] || 0 };

    if (!puede(actor, 'user:activate', objetivoConRango)) {
      return error('Sin permisos para activar este usuario (revisa la jerarquía de roles)', 403);
    }

    const { error: dbErr } = await supabase
      .from('usuarios')
      .update({ activo: true })
      .eq('id', id);

    if (dbErr) throw dbErr;
    return ok({ success: true, id, activo: true });
  } catch (err) {
    console.error('[usuarios-activar]', err.message);
    return error(err.message, esAuthError(err.message) ? 401 : 500);
  }
};
