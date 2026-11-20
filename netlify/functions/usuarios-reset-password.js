// netlify/functions/usuarios-reset-password.js
// POST /api/usuarios-reset-password — restablece la contraseña de un empleado
//
// Requiere: user:update (solo Admin) sobre el objetivo. Reutiliza la regla
// existente para no cambiar roles.js: anti-escalación (asigna) + noPropio.
// El admin no puede resetearse a sí mismo desde aquí (usa "Mi cuenta").
//
// Es el camino de recuperación de contraseña (no hay correo/SMTP).
// Incrementa sesion_version: el usuario queda deslogueado en todos lados.

const { query } = require('./_lib/db');
const token = require('./_lib/token');
const { verificarAuth, puede, ok, error, handleOptions, fallo, buscarObjetivo, leerJSON } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  try {
    const actor = await verificarAuth(event);

    const { id, newPass } = leerJSON(event);
    if (!id) return error('Falta id del usuario', 400);
    if (typeof newPass !== 'string' || newPass.length < 8) {
      return error('La nueva contraseña debe tener al menos 8 caracteres', 400);
    }

    const objetivo = await buscarObjetivo(id);
    if (!objetivo) return error('Usuario no encontrado', 404);

    if (!puede(actor, 'user:update', objetivo)) {
      return error('Sin permisos para restablecer la contraseña de este usuario', 403);
    }

    const hash = await token.hashPassword(newPass);
    await query(
      'UPDATE usuarios SET password_hash = $2, sesion_version = sesion_version + 1 WHERE id = $1',
      [id, hash]
    );
    return ok({ success: true, id });
  } catch (err) {
    return fallo('usuarios-reset-password', err);
  }
};
