(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Monext = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  'use strict';

  var DIAS = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
  var MESES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

  function toDate(iso) {
    if (iso instanceof Date) return iso;
    if (!iso) return null;
    if (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
      var p = iso.split('-');
      var d0 = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
      return isNaN(d0.getTime()) ? null : d0;
    }
    var d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // "DOM, 08 NOV"
  function formatFechaLetra(iso) {
    var d = toDate(iso);
    if (!d) return '';
    return DIAS[d.getDay()] + ', ' + pad(d.getDate()) + ' ' + MESES[d.getMonth()];
  }

  // "20 SEP 26"
  function formatFechaCorta(iso) {
    var d = toDate(iso);
    if (!d) return '';
    return pad(d.getDate()) + ' ' + MESES[d.getMonth()] + ' ' + String(d.getFullYear()).slice(-2);
  }

  // días y noches: checkIn 08 NOV -> checkOut 10 NOV === 3 días / 2 noches
  function nochesYDias(checkInIso, checkOutIso) {
    var a = toDate(checkInIso);
    var b = toDate(checkOutIso);
    if (!a || !b) return { noches: 0, dias: 0 };
    var diff = Math.round((b.getTime() - a.getTime()) / 86400000);
    if (diff < 0) diff = 0;
    return { noches: diff, dias: diff + 1 };
  }

  // "usd" -> "$"; "bs" -> "Bs."
  function simboloMoneda(moneda) {
    var m = String(moneda || 'USD').toUpperCase();
    if (m === 'USD' || m === '$' || m === 'US$') return '$';
    if (m === 'EUR' || m === '€') return '€';
    if (m === 'BS' || m === 'VES' || m === 'VEF') return 'Bs.';
    return m + ' ';
  }

  // $1,210  |  $605  |  1.234,56
  function formatMoney(n, moneda) {
    var num = Number(n) || 0;
    var sym = simboloMoneda(moneda || 'USD');
    var dec = Number.isInteger(num) ? 0 : 2;
    var grupo = Math.abs(num) >= 1000;
    var s = num.toLocaleString('en-US', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec,
      useGrouping: grupo,
    });
    return sym + s;
  }

  // montoTotal = adultos*tarifaAdulto + ninos*tarifaNino
  function calcularTotal(adultos, tarifaAdulto, ninos, tarifaNino) {
    var a = Number(adultos) || 0;
    var n = Number(ninos) || 0;
    var ta = Number(tarifaAdulto) || 0;
    var tn = Number(tarifaNino) || 0;
    return Math.round((a * ta + n * tn) * 100) / 100;
  }

  // "COT-2026-0920"
  function generadorIdCotizacion(fechaIso) {
    var d = toDate(fechaIso) || new Date();
    return 'COT-' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + pad(d.getDate());
  }

  function buildQuote(opts) {
    var o = opts || {};
    var hoy = toDate(o.fechaCotizacion) || new Date();
    var hosp = nochesYDias(o.checkIn, o.checkOut);
    var adultos = Number(o.adultos) || 0;
    var ninos = Number(o.ninos) || 0;
    var infantes = Number(o.infantes) || 0;
    var ta = Number(o.tarifaPorAdulto) || 0;
    var tn = Number(o.tarifaPorNino) || 0;
    var v = function (valor, fallback) {
      return (valor === undefined || valor === null || valor === '') ? fallback : String(valor);
    };

    return {
      idCotizacion: o.idCotizacion || generadorIdCotizacion(hoy),
      fechaCotizacion: formatFechaCorta(hoy).toUpperCase(),
      estado: v(o.estado, 'CONFIRMADO'),
      tipoPaquete: v(o.tipoPaquete, 'PAQUETE COMPLETO'),
      plantillaId: v(o.plantillaId, ''),
      vuelo: {
        aerolinea: v(o.aerolinea, ''),
        pnr: v(o.pnr, ''),
        equipaje: v(o.equipaje, ''),
        dinamicos: (o.vuelos || []).map(function(v) {
          return {
            tipo: v.tipo,
            origen: v.origen,
            destino: v.destino,
            fecha: v.fecha ? formatFechaLetra(v.fecha).toUpperCase() : '',
            salida: v.salida,
            llegada: v.llegada,
            duracion: v.duracion
          };
        }),
        ida: {
          origen: v(o.origenIda, 'CARACAS'),
          destino: v(o.destinoIda, 'LOS ROQUES'),
          fecha: o.fechaIda ? formatFechaLetra(o.fechaIda).toUpperCase() : '',
          salida: v(o.salidaIda, ''),
          llegada: v(o.llegadaIda, ''),
        },
        retorno: {
          origen: v(o.origenRetorno, 'LOS ROQUES'),
          destino: v(o.destinoRetorno, 'CARACAS'),
          fecha: o.fechaRetorno ? formatFechaLetra(o.fechaRetorno).toUpperCase() : '',
          salida: v(o.salidaRetorno, ''),
          llegada: v(o.llegadaRetorno, ''),
        },
      },
      hospedaje: {
        checkIn: o.checkIn ? formatFechaLetra(o.checkIn).toUpperCase() : '',
        checkInHora: v(o.checkInHora, ''),
        checkOut: o.checkOut ? formatFechaLetra(o.checkOut).toUpperCase() : '',
        checkOutHora: v(o.checkOutHora, ''),
        tipoHabitacion: v(o.tipoHabitacion, ''),
        servicio: v(o.servicio, ''),
        noches: hosp.noches,
        dias: hosp.dias,
      },
      pasajeros: {
        adultos: adultos,
        ninos: ninos,
        infantes: infantes,
      },
      tarifas: {
        tarifaPorAdulto: ta,
        tarifaPorNino: tn,
        moneda: v(o.moneda, 'USD'),
        montoTotal: calcularTotal(adultos, ta, ninos, tn),
      },
      inclusiones: o.inclusiones,
      fechaIso: hoy.toISOString(),
    };
  }

  return {
    formatFechaLetra: formatFechaLetra,
    formatFechaCorta: formatFechaCorta,
    nochesYDias: nochesYDias,
    simboloMoneda: simboloMoneda,
    formatMoney: formatMoney,
    calcularTotal: calcularTotal,
    generadorIdCotizacion: generadorIdCotizacion,
    buildQuote: buildQuote,
  };
});