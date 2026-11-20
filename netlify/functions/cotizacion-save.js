// netlify/functions/cotizacion-save.js
// POST /api/cotizacion-save — guarda una cotización al generar el PDF
// Requiere: quote:create (cualquier usuario autenticado)

const { query } = require('./_lib/db');
const { verificarAuth, puede, ok, error, handleOptions, fallo } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  try {
    const usuario = await verificarAuth(event);
    if (!puede(usuario, 'quote:create')) return error('Sin permisos', 403);

    const cot = JSON.parse(event.body || '{}');
    if (!cot.idCotizacion) return error('Falta idCotizacion', 400);

    const pax = cot.pasajeros || {};
    const tar = cot.tarifas || {};
    await query(`
      INSERT INTO cotizaciones (id, posada_id, generado_por, estado, tipo_paquete,
        pasajeros_adultos, pasajeros_ninos, pasajeros_infantes,
        tarifa_adulto, tarifa_nino, moneda, monto_total,
        datos_vuelo, datos_hospedaje, datos_cliente)
      VALUES ($1, (SELECT id FROM posadas WHERE id = $2), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NULL)
      ON CONFLICT (id) DO UPDATE SET
        posada_id = EXCLUDED.posada_id, generado_por = EXCLUDED.generado_por,
        estado = EXCLUDED.estado, tipo_paquete = EXCLUDED.tipo_paquete,
        pasajeros_adultos = EXCLUDED.pasajeros_adultos, pasajeros_ninos = EXCLUDED.pasajeros_ninos,
        pasajeros_infantes = EXCLUDED.pasajeros_infantes, tarifa_adulto = EXCLUDED.tarifa_adulto,
        tarifa_nino = EXCLUDED.tarifa_nino, moneda = EXCLUDED.moneda,
        monto_total = EXCLUDED.monto_total, datos_vuelo = EXCLUDED.datos_vuelo,
        datos_hospedaje = EXCLUDED.datos_hospedaje`,
      [
        cot.idCotizacion, cot.plantillaId || null, usuario.id,
        cot.estado || 'CONFIRMADO', cot.tipoPaquete || null,
        Number(pax.adultos) || 0, Number(pax.ninos) || 0, Number(pax.infantes) || 0,
        Number(tar.tarifaPorAdulto) || 0, Number(tar.tarifaPorNino) || 0,
        tar.moneda || 'USD', Number(tar.montoTotal) || 0,
        cot.vuelo ? JSON.stringify(cot.vuelo) : null,
        cot.hospedaje ? JSON.stringify(cot.hospedaje) : null,
      ]);

    return ok({ success: true, id: cot.idCotizacion });
  } catch (err) {
    return fallo('cotizacion-save', err);
  }
};
