// netlify/functions/auth-password.js
// POST /api/auth-password — { newPass } → { token }
//
// Cambia la contraseña propia (modal "Mi cuenta"). Reemplaza a
// supabase.auth.updateUser. Incrementa sesion_version: las demás sesiones
// abiertas de este usuario quedan cerradas y se devuelve un token nuevo.

const { query } = require('./_lib/db');
const token = require('./_lib/token');
const { verificarAuth, ok, error, handleOptions, fallo, leerJSON } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'POST') return error('Método no permitido', 405);

  try {
    const usuario = await verificarAuth(event);
    const { newPass } = leerJSON(event);
    if (typeof newPass !== 'string' || newPass.length < 8) {
      return error('La nueva contraseña debe tener al menos 8 caracteres', 400);
    }

    const hash = await token.hashPassword(newPass);
    const { rows } = await query(
      `UPDATE usuarios SET password_hash = $2, sesion_version = sesion_version + 1
        WHERE id = $1 RETURNING id, sesion_version`,
      [usuario.id, hash]
    );
    return ok({ success: true, token: token.emitir(rows[0]), expiraEnHoras: token.EXPIRA_HORAS });
  } catch (err) {
    return fallo('auth-password', err);
  }
};
