// netlify/functions/plantillas-save.js
// POST /api/plantillas-save — guarda (upsert) una plantilla individual
// Requiere: template:create o template:update
//
// Posada, inclusiones y fotos se escriben en UNA transacción: si algo falla
// no queda la posada a medias (antes podía quedar sin inclusiones).

const { query, tx } = require('./_lib/db');
const uploads = require('./_lib/uploads');
const { verificarAuth, puede, ok, error, handleOptions, fallo, leerJSON } = require('./_lib/auth');

// Fotos válidas: las servidas por /uploads/ (o URLs http(s) heredadas)
function esUrlFoto(u) {
  if (typeof u !== 'string' || u.length > 2000) return false;
  if (u.startsWith(uploads.URL_PREFIX)) return /^\/uploads\/[a-z0-9][a-z0-9-]{0,99}\/[a-z0-9]+\.(jpg|png|webp)$/i.test(u);
  return /^https?:\/\/[^\s"'<>]+$/i.test(u);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  try {
    const usuario = await verificarAuth(event);

    const plantilla = leerJSON(event);
    const texto = (v, max) => (typeof v === 'string' || typeof v === 'number') ? String(v).trim().slice(0, max) : '';
    plantilla.id = typeof plantilla.id === 'string' ? plantilla.id : '';
    plantilla.nombrePosada = texto(plantilla.nombrePosada, 200);
    plantilla.destino = texto(plantilla.destino, 200);
    if (!plantilla.id || !plantilla.nombrePosada || !plantilla.destino) {
      return error('Faltan campos requeridos: id, nombrePosada, destino (texto)', 400);
    }
    for (const campo of ['tipoServicioDefault', 'checkInHora', 'checkOutHora', 'tipoTemplate']) {
      if (plantilla[campo] != null && typeof plantilla[campo] !== 'string') {
        return error(`El campo ${campo} debe ser texto`, 400);
      }
      if (typeof plantilla[campo] === 'string') plantilla[campo] = plantilla[campo].slice(0, 200);
    }
    // Layout de fotos: entero de 1 a 4 (lo que ofrece el editor)
    const layout = Number(plantilla.layoutFotos);
    plantilla.layoutFotos = Number.isFinite(layout) ? Math.min(4, Math.max(1, Math.round(layout))) : 1;
    // Inclusiones: solo textos no vacíos (máx. 100 de 500 caracteres)
    plantilla.inclusiones = (Array.isArray(plantilla.inclusiones) ? plantilla.inclusiones : [])
      .map((x) => texto(x, 500)).filter(Boolean).slice(0, 100);
    if (!uploads.carpetaSegura(plantilla.id)) return error('id de plantilla inválido', 400);

    // El permiso depende de si la posada ya existe: crear o actualizar
    const { rows: existe } = await query('SELECT 1 FROM posadas WHERE id = $1', [plantilla.id]);
    const accion = existe.length ? 'template:update' : 'template:create';
    if (!puede(usuario, accion)) {
      return error(existe.length ? 'Sin permisos para actualizar plantillas' : 'Sin permisos para crear plantillas', 403);
    }

    const urls = Array.isArray(plantilla.imagenesBase64) ? plantilla.imagenesBase64.filter(esUrlFoto) : null;
    let fotosQuitadas = [];

    await tx(async (c) => {
      await c.query(`
        INSERT INTO posadas (id, nombre, destino, tipo_servicio_default, layout_fotos,
                             checkin_hora, checkout_hora, tipo_template, activa)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        ON CONFLICT (id) DO UPDATE SET
          nombre = EXCLUDED.nombre, destino = EXCLUDED.destino,
          tipo_servicio_default = EXCLUDED.tipo_servicio_default,
          layout_fotos = EXCLUDED.layout_fotos, checkin_hora = EXCLUDED.checkin_hora,
          checkout_hora = EXCLUDED.checkout_hora, tipo_template = EXCLUDED.tipo_template,
          activa = true`,
        [
          plantilla.id, plantilla.nombrePosada, plantilla.destino,
          plantilla.tipoServicioDefault || '', plantilla.layoutFotos,
          plantilla.checkInHora || '15:00', plantilla.checkOutHora || '13:00',
          plantilla.tipoTemplate || 'COMPLETO',
        ]);

      // Reemplazar inclusiones
      await c.query('DELETE FROM posada_inclusiones WHERE posada_id = $1', [plantilla.id]);
      const incl = plantilla.inclusiones;
      for (let i = 0; i < incl.length; i++) {
        await c.query('INSERT INTO posada_inclusiones (posada_id, texto, orden) VALUES ($1, $2, $3)',
          [plantilla.id, String(incl[i]), i]);
      }

      // Sincronizar fotos (solo si vienen URLs; las fotos se suben antes con /api/imagen-upload)
      if (urls && urls.length) {
        const { rows: previas } = await c.query('SELECT url FROM posada_fotos WHERE posada_id = $1', [plantilla.id]);
        fotosQuitadas = previas.map(r => r.url).filter(u => !urls.includes(u));
        await c.query('DELETE FROM posada_fotos WHERE posada_id = $1', [plantilla.id]);
        for (let i = 0; i < urls.length; i++) {
          await c.query('INSERT INTO posada_fotos (posada_id, url, orden, es_portada) VALUES ($1, $2, $3, $4)',
            [plantilla.id, urls[i], i, i === 0]);
        }
      }
    });

    // Fuera de la transacción: borrar del disco las fotos que se quitaron
    await uploads.borrarUrls(fotosQuitadas).catch(e => console.warn('[plantillas-save] limpieza:', e.message));
    // Fotos de plantillas nuevas que nunca se guardaron (subidas hace > 24 h)
    query('SELECT id FROM posadas')
      .then(({ rows }) => uploads.barrerHuerfanas(rows.map((r) => r.id)))
      .catch(e => console.warn('[plantillas-save] barrido:', e.message));

    return ok({ success: true, id: plantilla.id });
  } catch (err) {
    return fallo('plantillas-save', err);
  }
};
