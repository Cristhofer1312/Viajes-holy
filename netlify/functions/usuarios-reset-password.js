// netlify/functions/usuarios-reset-password.js
// POST /api/usuarios-reset-password — restablece la contraseña de un empleado
//
// Requiere: user:update (solo Admin) sobre el objetivo. Reutiliza la regla
// existente para no cambiar roles.js: anti-escalación (asigna) + noPropio.
// El admin no puede resetearse a sí mismo desde aquí (usa "Mi cuenta").

const { supabase } = require('./_lib/supabase');
const { verificarAuth, puede, ok, error, handleOptions } = require('./_lib/auth');

function esAuthError(msg) {
  return /Sin autorización|Token inválido|no registrado|inactivo/i.test(String(msg || ''));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  try {
    const actor = await verificarAuth(event);

    const { id, newPass } = JSON.parse(event.body || '{}');
    if (!id) return error('Falta id del usuario', 400);
    if (typeof newPass !== 'string' || newPass.length < 8) {
      return error('La nueva contraseña debe tener al menos 8 caracteres', 400);
    }

    const { data: objetivo, error: getErr } = await supabase
      .from('usuarios')
      .select('id, rol, activo')
      .eq('id', id)
      .single();

    if (getErr || !objetivo) return error('Usuario no encontrado', 404);

    if (!puede(actor, 'user:update', objetivo)) {
      return error('Sin permisos para restablecer la contraseña de este usuario', 403);
    }

    const { error: authErr } = await supabase.auth.admin.updateUserById(id, {
      password: newPass,
    });
    if (authErr) throw authErr;

    return ok({ success: true, id });
  } catch (err) {
    console.error('[usuarios-reset-password]', err.message);
    return error(err.message, esAuthError(err.message) ? 401 : 500);
  }
};
