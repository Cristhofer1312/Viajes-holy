// netlify/functions/usuarios-delete.js
// DELETE /api/usuarios-delete?id=<uuid> — elimina un usuario del sistema
//
// Requiere: user:delete (solo Admin). Dos guardas impiden dejar el sistema
// sin ningún administrador:
//   1. noPropio  — un admin no puede eliminarse a sí mismo
//   2. último admin — no se puede eliminar al único admin activo restante

const { supabase } = require('./_lib/supabase');
const { verificarAuth, puede, ok, error, handleOptions } = require('./_lib/auth');

// Cuenta los admins activos que quedarían si se eliminara `idExcluido`
async function adminsActivosRestantes(idExcluido) {
  const { count, error: countErr } = await supabase
    .from('usuarios')
    .select('id', { count: 'exact', head: true })
    .eq('rol', 'admin')
    .eq('activo', true)
    .neq('id', idExcluido);

  if (countErr) throw countErr;
  return count || 0;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  try {
    const actor = await verificarAuth(event);

    const id = event.queryStringParameters && event.queryStringParameters.id;
    if (!id) return error('Falta el parámetro id', 400);

    const { data: objetivo, error: getErr } = await supabase
      .from('usuarios')
      .select('id, rol, activo')
      .eq('id', id)
      .single();

    if (getErr || !objetivo) return error('Usuario no encontrado', 404);

    if (!puede(actor, 'user:delete', objetivo)) {
      return error('Sin permisos para eliminar este usuario', 403);
    }

    // Guarda: nunca dejar el sistema sin admins
    if (objetivo.rol === 'admin' && objetivo.activo) {
      const restantes = await adminsActivosRestantes(id);
      if (restantes === 0) {
        return error('No se puede eliminar al único administrador activo', 409);
      }
    }

    // Eliminar de auth.users (CASCADE borra el perfil en tabla usuarios)
    const { error: authErr } = await supabase.auth.admin.deleteUser(id);
    if (authErr) throw authErr;

    return ok({ success: true, id });
  } catch (err) {
    console.error('[usuarios-delete]', err.message);
    var msg = String(err.message || '');
    var status = /Sin autorización|Token inválido|no registrado|inactivo/i.test(msg) ? 401 : 500;
    return error(err.message, status);
  }
};
