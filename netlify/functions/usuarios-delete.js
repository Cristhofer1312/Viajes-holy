// netlify/functions/usuarios-delete.js
// DELETE /api/usuarios-delete?id=<uuid> — elimina un usuario del sistema
//
// Requiere: user:delete (solo Admin). Dos guardas impiden dejar el sistema
// sin ningún administrador:
//   1. noPropio  — un admin no puede eliminarse a sí mismo
//   2. último admin — no se puede eliminar al único admin activo restante
//
// Las cotizaciones y usuarios que creó quedan con generado_por/creado_por = NULL.

const { query } = require('./_lib/db');
const {
  verificarAuth, puede, ok, error, handleOptions, fallo, buscarObjetivo, adminsActivosRestantes,
} = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  try {
    const actor = await verificarAuth(event);

    const id = event.queryStringParameters && event.queryStringParameters.id;
    if (!id) return error('Falta el parámetro id', 400);

    const objetivo = await buscarObjetivo(id);
    if (!objetivo) return error('Usuario no encontrado', 404);

    if (!puede(actor, 'user:delete', objetivo)) {
      return error('Sin permisos para eliminar este usuario', 403);
    }

    // Guarda: nunca dejar el sistema sin admins
    if (objetivo.rol === 'admin' && objetivo.activo) {
      if ((await adminsActivosRestantes(id)) === 0) {
        return error('No se puede eliminar al único administrador activo', 409);
      }
    }

    await query('DELETE FROM usuarios WHERE id = $1', [id]);
    return ok({ success: true, id });
  } catch (err) {
    return fallo('usuarios-delete', err);
  }
};
