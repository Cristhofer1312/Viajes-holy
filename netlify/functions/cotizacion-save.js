// netlify/functions/cotizacion-save.js
// POST /api/cotizacion-save — guarda una cotización al generar el PDF
// Requiere: quote:create (cualquier usuario autenticado)

const { query } = require('./_lib/db');
const { verificarAuth, puede, ok, error, handleOptions, fallo, leerJSON, errorHttp } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  try {
    const usuario = await verificarAuth(event);
    if (!puede(usuario, 'quote:create')) return error('Sin permisos', 403);

    const cot = leerJSON(event);
    if (typeof cot.idCotizacion !== 'string' || !cot.idCotizacion.trim() || cot.idCotizacion.length > 100) {
      return error('idCotizacion debe ser un texto (máx. 100 caracteres)', 400);
    }
    // Montos y pasajeros: números finitos ≥ 0 dentro de lo que admite la
    // columna numeric(12,2). Fuera de rango es un error del cliente, no un 500.
    const MAX_MONTO = 9999999999.99;
    const numero = (v, campo, max) => {
      if (v == null || v === '') return 0;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > max) throw errorHttp(`${campo} fuera de rango`, 400);
      return n;
    };

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
        cot.idCotizacion.trim(), typeof cot.plantillaId === 'string' ? cot.plantillaId : null, usuario.id,
        String(cot.estado || 'CONFIRMADO').slice(0, 50), cot.tipoPaquete ? String(cot.tipoPaquete).slice(0, 50) : null,
        Math.floor(numero(pax.adultos, 'adultos', 1e6)), Math.floor(numero(pax.ninos, 'ninos', 1e6)),
        Math.floor(numero(pax.infantes, 'infantes', 1e6)),
        numero(tar.tarifaPorAdulto, 'tarifaPorAdulto', MAX_MONTO), numero(tar.tarifaPorNino, 'tarifaPorNino', MAX_MONTO),
        String(tar.moneda || 'USD').slice(0, 10), numero(tar.montoTotal, 'montoTotal', MAX_MONTO),
        cot.vuelo ? JSON.stringify(cot.vuelo) : null,
        cot.hospedaje ? JSON.stringify(cot.hospedaje) : null,
      ]);

    return ok({ success: true, id: cot.idCotizacion });
  } catch (err) {
    return fallo('cotizacion-save', err);
  }
};
