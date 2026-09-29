// netlify/functions/usuarios-save.js
// POST /api/usuarios-save — crea un usuario nuevo (alta inmediata)
//
// Requiere: user:create (solo Admin) y que el rol solicitado esté en la lista
// `asigna` de la regla (encargado | agente). Nadie crea otro admin desde la
// aplicación: un segundo admin se añade directamente en el panel de Supabase.

const { supabase } = require('./_lib/supabase');
const { verificarAuth, puede, ok, error, handleOptions } = require('./_lib/auth');

// Errores de autenticación → 401 (no enmascarar como 500)
function esAuthError(msg) {
  return /Sin autorización|Token inválido|no registrado|inactivo/i.test(String(msg || ''));
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  try {
    const actor = await verificarAuth(event);

    const raw = JSON.parse(event.body || '{}');
    const email = typeof raw.email === 'string' ? raw.email.trim().toLowerCase() : '';
    const nombre = typeof raw.nombre === 'string' ? raw.nombre.trim() : '';
    const rol = raw.rol;
    const pass = raw.pass;
    if (!email || !nombre || !rol || !pass) {
      return error('Faltan campos: email, nombre, rol, pass', 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return error('Email inválido', 400);
    }
    if (typeof pass !== 'string' || pass.length < 8) {
      return error('La contraseña debe tener al menos 8 caracteres', 400);
    }
    if (!['admin', 'encargado', 'agente'].includes(rol)) return error('Rol inválido', 400);

    // Anti-escalación: el actor no puede otorgar un rol que no tenga en `asigna`
    if (!puede(actor, 'user:create', { rol })) {
      return error('Sin permisos para crear un usuario con ese rol', 403);
    }

    // 1. Crear la cuenta en Supabase Auth, ya confirmada (alta inmediata)
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email,
      password: pass,
      email_confirm: true,
    });
    if (authErr) {
      if (/already/i.test(authErr.message)) return error('Ese email ya está registrado', 409);
      throw authErr;
    }

    // 2. Insertar el perfil activo en la tabla usuarios
    const { error: perfilErr } = await supabase.from('usuarios').insert({
      id:         authData.user.id,
      nombre,
      rol,
      activo:     true,
      creado_por: actor.id,
    });

    if (perfilErr) {
      // No dejar una cuenta huérfana en auth sin perfil en la tabla usuarios
      await supabase.auth.admin.deleteUser(authData.user.id);
      throw perfilErr;
    }

    return ok({ success: true, id: authData.user.id, email, nombre, rol, activo: true }, 201);
  } catch (err) {
    console.error('[usuarios-save]', err.message);
    return error(err.message, esAuthError(err.message) ? 401 : 500);
  }
};
