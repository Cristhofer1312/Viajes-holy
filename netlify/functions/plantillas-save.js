// netlify/functions/plantillas-save.js
// POST /api/plantillas — guarda (upsert) una plantilla individual
// Requiere: template:create o template:update

const { supabase } = require('./_lib/supabase');
const { verificarAuth, puede, ok, error, handleOptions } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  try {
    // Autenticación y autorización
    const usuario = await verificarAuth(event);

    const plantilla = JSON.parse(event.body || '{}');
    if (!plantilla.id || !plantilla.nombrePosada || !plantilla.destino) {
      return error('Faltan campos requeridos: id, nombrePosada, destino', 400);
    }

    // El permiso depende de si la posada ya existe: crear o actualizar
    const { data: existente, error: existeErr } = await supabase
      .from('posadas')
      .select('id')
      .eq('id', plantilla.id)
      .maybeSingle();

    if (existeErr) throw existeErr;

    if (existente) {
      if (!puede(usuario, 'template:update')) {
        return error('Sin permisos para actualizar plantillas', 403);
      }
    } else {
      if (!puede(usuario, 'template:create')) {
        return error('Sin permisos para crear plantillas', 403);
      }
    }

    // Upsert de la posada (inserta o actualiza si ya existe)
    const { error: upsertErr } = await supabase
      .from('posadas')
      .upsert({
        id:                    plantilla.id,
        nombre:                plantilla.nombrePosada,
        destino:               plantilla.destino,
        tipo_servicio_default: plantilla.tipoServicioDefault || '',
        layout_fotos:          plantilla.layoutFotos || 1,
        checkin_hora:          plantilla.checkInHora  || '15:00',
        checkout_hora:         plantilla.checkOutHora || '13:00',
        tipo_template:         plantilla.tipoTemplate || 'COMPLETO',
        activa:                true,
      }, { onConflict: 'id' });

    if (upsertErr) throw upsertErr;

    // Reemplazar inclusiones: borrar las actuales e insertar las nuevas
    await supabase.from('posada_inclusiones').delete().eq('posada_id', plantilla.id);
    if (Array.isArray(plantilla.inclusiones) && plantilla.inclusiones.length) {
      const inclRows = plantilla.inclusiones.map((texto, i) => ({
        posada_id: plantilla.id,
        texto,
        orden: i,
      }));
      const { error: inclErr } = await supabase.from('posada_inclusiones').insert(inclRows);
      if (inclErr) throw inclErr;
    }

    // Las fotos se manejan por separado con /api/imagen-upload
    // Si vienen URLs en imagenesBase64[], sincronizarlas también
    if (Array.isArray(plantilla.imagenesBase64) && plantilla.imagenesBase64.length) {
      // Solo procesar URLs válidas (no Base64 raw)
      const urls = plantilla.imagenesBase64.filter(u => u && u.startsWith('http'));
      if (urls.length) {
        await supabase.from('posada_fotos').delete().eq('posada_id', plantilla.id);
        const fotoRows = urls.map((url, i) => ({
          posada_id:  plantilla.id,
          url,
          orden:      i,
          es_portada: i === 0,
        }));
        await supabase.from('posada_fotos').insert(fotoRows);
      }
    }

    return ok({ success: true, id: plantilla.id });
  } catch (err) {
    console.error('[plantillas-save]', err.message);
    return error(err.message, 500);
  }
};
