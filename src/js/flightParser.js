(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.FlightParser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  'use strict';

  // Código IATA (2 chars) -> nombre para q-aerolinea
  var AIRLINES = {
    CV: 'AEROCARIBE',
    V0: 'CONVIASA',
    QL: 'LASER AIRLINES',
    '9V': 'AVIOR AIRLINES',
    AW: 'VENEZOLANA (RAVSA)',
    WW: 'VENEZOLANA (RAVSA)',
    '5R': 'RUTACA AIRLINES',
    ES: 'ESTELAR AIRLINES',
    CW: 'AEROPOSTAL',
    T9: 'TURPIAL AIRLINES',
    G0: 'ALBATROS',
    O3: 'SASCA AIRLINES',
    DO: 'SKY HIGH',
    '9R': 'SATENA'
  };

  // Código aeropuerto (3 letras) -> nombre destino
  var AIRPORTS = {
    CCS: 'CARACAS',
    VLN: 'VALENCIA',
    MAR: 'MARACAIBO',
    PMV: 'PORLAMAR',
    BLA: 'BARCELONA',
    LPS: 'LAS PIEDRAS',
    MUN: 'MATURIN',
    STD: 'SANTO DOMINGO DEL TACHIRA',
    LFR: 'LA FRIA',
    BRM: 'BARQUISIMETO',
    MRD: 'MERIDA',
    VIG: 'EL VIGIA',
    PZO: 'PUERTO ORDAZ',
    CBL: 'CIUDAD BOLIVAR',
    CUM: 'CUMANA',
    SFD: 'SAN FERNANDO DE APURE',
    AGV: 'ACARIGUA',
    BNS: 'BARINAS',
    PYH: 'PUERTO AYACUCHO',
    CAJ: 'CANAIMA',
    LRV: 'LOS ROQUES'
  };

  var MONTHS = {
    JAN: 1, ENE: 1,
    FEB: 2,
    MAR: 3,
    APR: 4, ABR: 4,
    MAY: 5,
    JUN: 6,
    JUL: 7,
    AUG: 8, AGO: 8,
    SEP: 9, SEPT: 9, SET: 9,
    OCT: 10,
    NOV: 11,
    DEC: 12, DIC: 12
  };

  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  function normalizeTime(raw) {
    var t = String(raw || '').replace(/\D/g, '');
    if (t.length === 3) t = '0' + t; // 945 -> 0945
    if (t.length !== 4) return '';
    var h = Number(t.slice(0, 2));
    var m = Number(t.slice(2, 4));
    if (h > 23 || m > 59) return '';
    return pad(h) + ':' + pad(m);
  }

  function resolveYear(day, month, today) {
    var ref = today instanceof Date ? today : new Date();
    var y = ref.getFullYear();
    var candidate = new Date(y, month - 1, day);
    // Si la fecha ya pasó hace más de 7 días, se asume el año siguiente
    // (las cotizaciones siempre son a futuro).
    var diffDays = Math.round((candidate.getTime() - ref.getTime()) / 86400000);
    if (diffDays < -7) y += 1;
    return y;
  }

  // Ej: "CV1723M 23OCT FR CCSLRV SS1   0945 1025"
  function parseFlightLine(text, opts) {
    if (!text || !String(text).trim()) return { error: 'Pega el texto del vuelo primero.' };
    var raw = String(text).toUpperCase().replace(/\s+/g, ' ').trim();

    // Aerolínea + nº vuelo al inicio: "CV1723M" / "V01723" / "9V1234"
    var head = raw.match(/^([A-Z0-9]{2})\s?(\d{1,4})\s?[A-Z]?\b/);
    // Fecha: "23OCT" o "23 OCT" o "23SEPT"
    var dateM = raw.match(/\b(\d{1,2})\s?(JAN|FEB|MAR|APR|ABR|MAY|JUN|JUL|AUG|AGO|SEP|SEPT|SET|OCT|NOV|DEC|ENE|DIC)\b/);
    // Ruta: "CCSLRV" o "CCS LRV" o "CCS-LRV"
    var routeM = raw.match(/\b([A-Z]{3})\s?[-]?\s?([A-Z]{3})\b/);
    // Horas: últimos dos grupos de 3-4 dígitos ("0945 1025")
    var times = raw.match(/(\d{3,4})\s+(\d{3,4})(?!\d)\s*$/);

    if (!head) return { error: 'No detecté la aerolínea (ej: CV1723M...).', raw: raw };
    if (!dateM) return { error: 'No detecté la fecha (ej: 23OCT).', raw: raw };
    if (!routeM) return { error: 'No detecté la ruta (ej: CCSLRV).', raw: raw };
    if (!times) return { error: 'No detecté las horas (ej: 0945 1025).', raw: raw };

    var airlineCode = head[1];
    var flightNumber = head[2];
    var day = Number(dateM[1]);
    var month = MONTHS[dateM[2]];
    if (!month || day < 1 || day > 31) return { error: 'Fecha no válida: ' + dateM[0], raw: raw };

    var today = (opts && opts.today instanceof Date) ? opts.today : new Date();
    var year = resolveYear(day, month, today);
    var fechaISO = year + '-' + pad(month) + '-' + pad(day);

    var origenCode = routeM[1];
    var destinoCode = routeM[2];
    var salida = normalizeTime(times[1]);
    var llegada = normalizeTime(times[2]);
    if (!salida || !llegada) return { error: 'Horas no válidas: ' + times[0], raw: raw };

    return {
      aerolineaCode: airlineCode,
      aerolinea: AIRLINES[airlineCode] || airlineCode,
      aerolineaRegistrada: Object.prototype.hasOwnProperty.call(AIRLINES, airlineCode),
      numeroVuelo: flightNumber,
      fechaISO: fechaISO,
      dia: day,
      mes: month,
      anio: year,
      origenCode: origenCode,
      destinoCode: destinoCode,
      origen: AIRPORTS[origenCode] || origenCode,
      destino: AIRPORTS[destinoCode] || destinoCode,
      salida: salida,
      llegada: llegada,
      raw: raw
    };
  }

  return {
    AIRLINES: AIRLINES,
    AIRPORTS: AIRPORTS,
    parseFlightLine: parseFlightLine
  };
});
