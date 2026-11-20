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
    if (diff < 0) return { noches: 0, dias: 0, invertidas: true };
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

  // Monto escrito a mano → número ≥ 0. Acepta coma decimal (uso venezolano):
  // "350,50" → 350.5 · "1.234,56" → 1234.56 · "1,234.56" → 1234.56 · "$ 90" → 90
  // Un solo separador seguido de exactamente 3 dígitos es de miles:
  // "1.234" → 1234 y "1,234" → 1234 (en Venezuela "1.234" son mil doscientos…).
  // Negativos, texto o valores no finitos → 0.
  function parseMonto(v) {
    if (typeof v === 'number') return isFinite(v) && v > 0 ? v : 0;
    // Se ignoran espacios y símbolos de moneda; cualquier otra letra → inválido
    var s = String(v == null ? '' : v).replace(/\s|\$|€|bs\.?|usd|eur/gi, '');
    if (!s || !/^[\d.,]+$/.test(s)) return 0;
    var coma = s.lastIndexOf(','), punto = s.lastIndexOf('.');
    if (coma !== -1 && punto !== -1) {
      // el separador que aparece último es el decimal
      s = coma > punto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
    } else if (coma !== -1) {
      // "1,234" → miles; "0,100" o "350,50" → decimal
      s = (s.split(',').length > 2 || /^[1-9]\d{0,2},\d{3}$/.test(s)) ? s.replace(/,/g, '') : s.replace(',', '.');
    } else if (s.split('.').length > 2 || /^[1-9]\d{0,2}\.\d{3}$/.test(s)) {
      s = s.replace(/\./g, '');   // "1.234" / "1.234.567" → miles
    }
    var n = Number(s);
    return isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  }

  // Cantidad de pasajeros → entero ≥ 0
  function parseCantidad(v) {
    var n = Math.floor(Number(v));
    return isFinite(n) && n > 0 ? n : 0;
  }

  // montoTotal = adultos*tarifaAdulto + ninos*tarifaNino
  function calcularTotal(adultos, tarifaAdulto, ninos, tarifaNino) {
    var a = parseCantidad(adultos);
    var n = parseCantidad(ninos);
    var ta = parseMonto(tarifaAdulto);
    var tn = parseMonto(tarifaNino);
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
    var adultos = parseCantidad(o.adultos);
    var ninos = parseCantidad(o.ninos);
    var infantes = parseCantidad(o.infantes);
    var ta = parseMonto(o.tarifaPorAdulto);
    var tn = parseMonto(o.tarifaPorNino);
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
        fechasInvertidas: !!hosp.invertidas,
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
    parseMonto: parseMonto,
    parseCantidad: parseCantidad,
    generadorIdCotizacion: generadorIdCotizacion,
    buildQuote: buildQuote,
  };
});