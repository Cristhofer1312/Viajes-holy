// netlify/functions/cotizacion-save.js
// POST /api/cotizacion-save — guarda una cotización al generar el PDF
// Requiere: quote:create (cualquier usuario autenticado)

const { supabase } = require('./_lib/supabase');
const { verificarAuth, puede, ok, error, handleOptions } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  try {
    const usuario = await verificarAuth(event);
    if (!puede(usuario, 'quote:create')) return error('Sin permisos', 403);

    const cot = JSON.parse(event.body || '{}');
    if (!cot.idCotizacion) return error('Falta idCotizacion', 400);

    const { error: dbErr } = await supabase
      .from('cotizaciones')
      .upsert({
        id:                  cot.idCotizacion,
        posada_id:           cot.plantillaId || null,
        generado_por:        usuario.id,
        estado:              cot.estado || 'CONFIRMADO',
        tipo_paquete:        cot.tipoPaquete || null,
        pasajeros_adultos:   cot.pasajeros ? cot.pasajeros.adultos : 0,
        pasajeros_ninos:     cot.pasajeros ? cot.pasajeros.ninos : 0,
        pasajeros_infantes:  cot.pasajeros ? cot.pasajeros.infantes : 0,
        tarifa_adulto:       cot.tarifas ? cot.tarifas.tarifaPorAdulto : 0,
        tarifa_nino:         cot.tarifas ? cot.tarifas.tarifaPorNino : 0,
        moneda:              cot.tarifas ? cot.tarifas.moneda : 'USD',
        monto_total:         cot.tarifas ? cot.tarifas.montoTotal : 0,
        datos_vuelo:         cot.vuelo || null,
        datos_hospedaje:     cot.hospedaje || null,
        datos_cliente:       null, // para implementación futura
      }, { onConflict: 'id' });

    if (dbErr) throw dbErr;
    return ok({ success: true, id: cot.idCotizacion });
  } catch (err) {
    console.error('[cotizacion-save]', err.message);
    return error(err.message, 500);
  }
};
