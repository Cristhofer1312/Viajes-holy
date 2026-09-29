// netlify/functions/usuarios-list.js
// GET /api/usuarios-list — lista todos los usuarios del sistema
// Requiere: user:read (Admin y Encargado)

const { supabase } = require('./_lib/supabase');
const { verificarAuth, puede, ok, error, handleOptions } = require('./_lib/auth');

function esAuthError(msg) {
  return /Sin autorización|Token inválido|no registrado|inactivo/i.test(String(msg || ''));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  try {
    const usuario = await verificarAuth(event);
    if (!puede(usuario, 'user:read')) return error('Sin permisos para ver usuarios', 403);

    const { data, error: dbErr } = await supabase
      .from('usuarios')
      .select('id, nombre, rol, activo, creado_at, creado_por')
      .order('creado_at', { ascending: true });

    if (dbErr) throw dbErr;

    // Enriquecer con email desde Auth (retrocompatible: solo añade campos)
    let emailPorId = {};
    try {
      const { data: authData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      (authData.users || []).forEach(function (u) {
        emailPorId[u.id] = u.email || '';
      });
    } catch (e) {
      console.error('[usuarios-list] no se pudo leer emails:', e.message);
    }

    // Nombre del creador para auditoría legible
    const nombrePorId = {};
    (data || []).forEach(function (u) { nombrePorId[u.id] = u.nombre; });

    const out = (data || []).map(function (u) {
      return {
        id: u.id,
        nombre: u.nombre,
        email: emailPorId[u.id] || '',
        rol: u.rol,
        activo: u.activo,
        creado_at: u.creado_at,
        creado_por: u.creado_por,
        creado_por_nombre: (u.creado_por && nombrePorId[u.creado_por]) || '',
      };
    });
    return ok(out);
  } catch (err) {
    console.error('[usuarios-list]', err.message);
    return error(err.message, esAuthError(err.message) ? 401 : 500);
  }
};
