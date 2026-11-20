// netlify/functions/plantillas-list.js
// GET /api/plantillas-list — devuelve el catálogo completo en el formato que
// espera app.js
//
// Requiere: catalog:read (los tres roles). El catálogo no es público: sin un
// JWT válido la respuesta es 401 y el cliente debe esperar a Auth.ready().

const { query } = require('./_lib/db');
const { verificarAuth, puede, ok, error, handleOptions, fallo } = require('./_lib/auth');

function mapRow(p) {
  const fotos = p.fotos || [];
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
    inclusiones:          (p.inclusiones || []).map(i => i.texto),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  try {
    const usuario = await verificarAuth(event);
    if (!puede(usuario, 'catalog:read')) {
      return error('Sin permisos para leer el catálogo', 403);
    }

    const { rows } = await query(`
      SELECT p.*,
        COALESCE((SELECT json_agg(json_build_object('url', f.url, 'es_portada', f.es_portada) ORDER BY f.orden, f.id)
                    FROM posada_fotos f WHERE f.posada_id = p.id), '[]') AS fotos,
        COALESCE((SELECT json_agg(json_build_object('texto', i.texto) ORDER BY i.orden, i.id)
                    FROM posada_inclusiones i WHERE i.posada_id = p.id), '[]') AS inclusiones
        FROM posadas p
       WHERE p.activa
       ORDER BY p.fecha_creacion ASC, p.id ASC`);

    return ok(rows.map(mapRow));
  } catch (err) {
    return fallo('plantillas-list', err);
  }
};
