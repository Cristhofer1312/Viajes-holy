// netlify/functions/usuarios-save.js
// POST /api/usuarios-save — crea un usuario nuevo (alta inmediata)
//
// Requiere: user:create (solo Admin) y que el rol solicitado esté en la lista
// `asigna` de la regla (encargado | agente). Nadie crea otro admin desde la
// aplicación: un admin se añade con scripts/create-admin.js.

const { query } = require('./_lib/db');
const token = require('./_lib/token');
const { verificarAuth, puede, ok, error, handleOptions, fallo } = require('./_lib/auth');

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

    const hash = await token.hashPassword(pass);
    try {
      const { rows } = await query(
        `INSERT INTO usuarios (email, password_hash, nombre, rol, activo, creado_por)
         VALUES ($1, $2, $3, $4, true, $5) RETURNING id`,
        [email, hash, nombre, rol, actor.id]
      );
      return ok({ success: true, id: rows[0].id, email, nombre, rol, activo: true }, 201);
    } catch (e) {
      if (e.code === '23505') return error('Ese email ya está registrado', 409); // unique_violation
      throw e;
    }
  } catch (err) {
    return fallo('usuarios-save', err);
  }
};
