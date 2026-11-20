// netlify/functions/plantillas-delete.js
// DELETE /api/plantillas-delete?id=<posada> — elimina una posada y sus
// fotos/inclusiones (CASCADE en BD + carpeta en disco)
// Requiere: template:delete (Admin / Encargado)

const { query } = require('./_lib/db');
const uploads = require('./_lib/uploads');
const { verificarAuth, puede, ok, error, handleOptions, fallo } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  try {
    const usuario = await verificarAuth(event);
    if (!puede(usuario, 'template:delete')) return error('Sin permisos: solo Admin o Encargado pueden eliminar plantillas', 403);

    const id = event.queryStringParameters && event.queryStringParameters.id;
    if (!id) return error('Falta el parámetro id', 400);

    const { rows: fotos } = await query('SELECT url FROM posada_fotos WHERE posada_id = $1', [id]);
    const { rowCount } = await query('DELETE FROM posadas WHERE id = $1', [id]);
    if (!rowCount) return error('Plantilla no encontrada', 404);

    // Archivos: la carpeta de la posada y, por si alguna foto vivía en otra, cada URL
    await uploads.borrarPosada(id).catch(e => console.warn('[plantillas-delete] carpeta:', e.message));
    await uploads.borrarUrls(fotos.map(f => f.url)).catch(e => console.warn('[plantillas-delete] fotos:', e.message));

    return ok({ success: true, id });
  } catch (err) {
    return fallo('plantillas-delete', err);
  }
};
