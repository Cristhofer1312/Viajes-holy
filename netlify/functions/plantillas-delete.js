// netlify/functions/plantillas-delete.js
// DELETE /api/plantillas/:id — elimina una posada y sus fotos/inclusiones (CASCADE)
// Requiere: template:delete (Admin / Encargado)

const { supabase } = require('./_lib/supabase');
const { verificarAuth, puede, ok, error, handleOptions } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  try {
    const usuario = await verificarAuth(event);
    if (!puede(usuario, 'template:delete')) return error('Sin permisos: solo Admin o Encargado pueden eliminar plantillas', 403);

    // El id viene en la URL: /api/plantillas-delete?id=posada-corales-lr
    // o como parámetro en el path si se usa un enrutador
    const id = event.queryStringParameters && event.queryStringParameters.id;
    if (!id) return error('Falta el parámetro id', 400);

    // Primero obtener las fotos para eliminarlas del Storage
    const { data: fotos } = await supabase
      .from('posada_fotos')
      .select('url')
      .eq('posada_id', id);

    // Eliminar archivos del Storage (las URLs son del tipo https://xxx.supabase.co/storage/...)
    if (fotos && fotos.length) {
      const paths = fotos.map(f => {
        // Extraer la ruta relativa del bucket desde la URL completa
        const match = f.url.match(/posadas-fotos\/(.+)/);
        return match ? match[1] : null;
      }).filter(Boolean);

      if (paths.length) {
        await supabase.storage.from('posadas-fotos').remove(paths);
      }
    }

    // Eliminar la posada (CASCADE borra fotos e inclusiones en BD)
    const { error: delErr } = await supabase
      .from('posadas')
      .delete()
      .eq('id', id);

    if (delErr) throw delErr;

    return ok({ success: true, id });
  } catch (err) {
    console.error('[plantillas-delete]', err.message);
    return error(err.message, 500);
  }
};
