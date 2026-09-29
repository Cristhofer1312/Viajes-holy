// netlify/functions/plantillas-list.js
// GET /api/plantillas-list — devuelve el catálogo completo en el formato que
// espera app.js
//
// Requiere: catalog:read (los tres roles). El catálogo no es público: sin un
// JWT válido la respuesta es 401 y el cliente debe esperar a Auth.ready().

const { supabase } = require('./_lib/supabase');
const { verificarAuth, puede, ok, error, handleOptions } = require('./_lib/auth');

function mapRow(p) {
  const fotos = (p.posada_fotos || []).sort((a, b) => a.orden - b.orden);
  const incl  = (p.posada_inclusiones || []).sort((a, b) => a.orden - b.orden);
  const portada = fotos.find(f => f.es_portada) || fotos[0];
  return {
    id:                   p.id,
    nombrePosada:         p.nombre,
    destino:              p.destino,
    tipoServicioDefault:  p.tipo_servicio_default || '',
    layoutFotos:          p.layout_fotos || 1,
    checkInHora:          p.checkin_hora  || '15:00',
    checkOutHora:         p.checkout_hora || '13:00',
    tipoTemplate:         p.tipo_template || 'COMPLETO',
    fechaCreacion:        p.fecha_creacion,
    imagenesBase64:       fotos.map(f => f.url),
    fotoPortada:          portada ? portada.url : '',
    inclusiones:          incl.map(i => i.texto),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  try {
    const usuario = await verificarAuth(event);
    if (!puede(usuario, 'catalog:read')) {
      return error('Sin permisos para leer el catálogo', 403);
    }

    const { data, error: dbError } = await supabase
      .from('posadas')
      .select(`
        *,
        posada_fotos ( id, url, orden, es_portada ),
        posada_inclusiones ( id, texto, orden )
      `)
      .eq('activa', true)
      .order('fecha_creacion', { ascending: true });

    if (dbError) throw dbError;
    return ok((data || []).map(mapRow));
  } catch (err) {
    console.error('[plantillas-list]', err.message);
    return error(err.message, 500);
  }
};
