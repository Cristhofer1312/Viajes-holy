(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.FlightParser = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  'use strict';

  // Código IATA (2 chars) -> nombre para q-aerolinea.
  // Fuente de los códigos: tabla de aerolíneas de Venezuela (Wikipedia,
  // revisada nov-2026). Los códigos antiguos se mantienen como alias
  // porque algunos sistemas de reserva todavía los muestran.
  var AIRLINES = {
    // ── Venezolanas, vuelos regulares ──
    V0: 'CONVIASA',
    '9V': 'AVIOR AIRLINES',
    QL: 'LASER AIRLINES',
    ES: 'ESTELAR AIRLINES',
    RU: 'RUTACA AIRLINES',
    '5R': 'RUTACA AIRLINES',     // código anterior de Rutaca
    T9: 'TURPIAL AIRLINES',
    O3: 'SASCA AIRLINES',
    CV: 'AEROCARIBE',
    CW: 'AEROPOSTAL',
    VH: 'AEROPOSTAL',            // código histórico de Aeropostal
    // ── Venezolanas, chárter ──
    WW: 'VENEZOLANA (RAVSA)',
    AW: 'VENEZOLANA (RAVSA)',    // alias usado antes en este sistema
    G0: 'ALBATROS',
    // ── Extranjeras que operan o han operado rutas a Venezuela ──
    CM: 'COPA AIRLINES',
    AV: 'AVIANCA',
    P5: 'WINGO',
    '9R': 'SATENA',
    DO: 'SKY HIGH',
    DM: 'ARAJET',
    IB: 'IBERIA',
    UX: 'AIR EUROPA',
    PU: 'PLUS ULTRA',
    TP: 'TAP AIR PORTUGAL',
    TK: 'TURKISH AIRLINES',
    OB: 'BOLIVIANA DE AVIACION',
    AA: 'AMERICAN AIRLINES',
    CU: 'CUBANA DE AVIACION'
  };

  // Aerolíneas venezolanas sin código IATA (taxis aéreos y chárter, p. ej.
  // a Los Roques o Canaima): no aparecen en una línea de reserva, pero se
  // sugieren al escribir el nombre de la aerolínea a mano.
  var AIRLINES_SIN_IATA = [
    'BLUESTAR AVIATION',
    'TRANSMANDU',
    'CIACA AIRLINES',
    'SUNDANCE AIR',
    'MORAIMA AIRLINES',
    'AEROTECNICA',
    'COMERAVIA',
    'SERVICIOS AEREOS MINEROS'
  ];

  // Código aeropuerto (3 letras) -> nombre destino
  var AIRPORTS = {
    // ── Venezuela ──
    CCS: 'CARACAS',
    VLN: 'VALENCIA',
    MAR: 'MARACAIBO',
    PMV: 'PORLAMAR',
    BLA: 'BARCELONA',
    LSP: 'LAS PIEDRAS',
    LPS: 'LAS PIEDRAS',          // código erróneo usado antes; se conserva
    MUN: 'MATURIN',
    STD: 'SANTO DOMINGO DEL TACHIRA',
    SVZ: 'SAN ANTONIO DEL TACHIRA',
    LFR: 'LA FRIA',
    BRM: 'BARQUISIMETO',
    MRD: 'MERIDA',
    VIG: 'EL VIGIA',
    PZO: 'PUERTO ORDAZ',
    CBL: 'CIUDAD BOLIVAR',
    CUM: 'CUMANA',
    CUP: 'CARUPANO',
    GUI: 'GUIRIA',
    SFD: 'SAN FERNANDO DE APURE',
    AGV: 'ACARIGUA',
    BNS: 'BARINAS',
    GUQ: 'GUANARE',
    PYH: 'PUERTO AYACUCHO',
    PPZ: 'PUERTO PAEZ',
    CAJ: 'CANAIMA',
    KTV: 'KAMARATA',
    KAV: 'KAVANAYEN',
    URM: 'URIMAN',
    WOK: 'WONKEN',
    ICA: 'ICABARU',
    SNV: 'SANTA ELENA DE UAIREN',
    TMO: 'TUMEREMO',
    LRV: 'LOS ROQUES',
    CZE: 'CORO',
    VLV: 'VALERA',
    VCR: 'CARORA',
    SNF: 'SAN FELIPE',
    MYC: 'MARACAY',
    PBL: 'PUERTO CABELLO',
    HGE: 'HIGUEROTE',
    TUV: 'TUCUPITA',
    SOM: 'SAN TOME',
    ELX: 'EL TIGRE',
    AAO: 'ANACO',
    VDP: 'VALLE DE LA PASCUA',
    CLZ: 'CALABOZO',
    GDO: 'GUASDUALITO',
    EOR: 'ELORZA',
    STB: 'SANTA BARBARA DEL ZULIA',
    // ── Destinos internacionales frecuentes ──
    BOG: 'BOGOTA',
    MDE: 'MEDELLIN',
    CUC: 'CUCUTA',
    PTY: 'PANAMA',
    MIA: 'MIAMI',
    MAD: 'MADRID',
    LIS: 'LISBOA',
    TFN: 'TENERIFE',
    SDQ: 'SANTO DOMINGO',
    PUJ: 'PUNTA CANA',
    LRM: 'LA ROMANA',
    CUR: 'CURAZAO',
    AUA: 'ARUBA',
    BON: 'BONAIRE',
    HAV: 'LA HABANA',
    CUN: 'CANCUN',
    MEX: 'CIUDAD DE MEXICO',
    LIM: 'LIMA',
    UIO: 'QUITO',
    GYE: 'GUAYAQUIL',
    VVI: 'SANTA CRUZ',
    SCL: 'SANTIAGO DE CHILE',
    EZE: 'BUENOS AIRES',
    GRU: 'SAO PAULO',
    POS: 'PUERTO ESPAÑA',
    BGI: 'BARBADOS',
    IST: 'ESTAMBUL'
  };

  /** Nombres de todas las aerolíneas conocidas, sin repetir, para sugerencias. */
  function nombresAerolineas() {
    var vistos = {};
    var out = [];
    Object.keys(AIRLINES).map(function (k) { return AIRLINES[k]; })
      .concat(AIRLINES_SIN_IATA)
      .forEach(function (n) { if (!vistos[n]) { vistos[n] = true; out.push(n); } });
    return out.sort();
  }

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
    // Número de tramo al inicio (Amadeus/KIU): "1 V0 1234…", "2. CV1723…"
    raw = raw.replace(/^\d{1,2}\s*[.)]?\s+(?=[A-Z0-9]{2}\s?\d)/, '');

    // Aerolínea + nº vuelo al inicio: "CV1723M" / "V01723" / "9V1234"
    var head = raw.match(/^([A-Z0-9]{2})\s?(\d{1,4})\s?[A-Z]?\b/);
    // Fecha: "23OCT" o "23 OCT" o "23SEPT"
    var dateM = raw.match(/\b(\d{1,2})\s?(JAN|FEB|MAR|APR|ABR|MAY|JUN|JUL|AUG|AGO|SEP|SEPT|SET|OCT|NOV|DEC|ENE|DIC)\b/);
    // Ruta: "CCSLRV" o "CCS LRV" o "CCS-LRV"
    var routeM = raw.match(/\b([A-Z]{3})\s?[-]?\s?([A-Z]{3})\b/);
    // Horas: primer par de grupos de 3-4 dígitos después de la ruta
    // ("0945 1025"); tolera "+1" (llega al día siguiente) y datos extra al
    // final de la línea (fecha de llegada, equipo, localizador…).
    var times = null;
    if (routeM) {
      var resto = raw.slice(routeM.index + routeM[0].length);
      times = resto.match(/(?:^|\s)(\d{3,4})\s+(\d{3,4})(\+\d)?(?=\s|$)/);
    }

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
    // 30FEB, 31ABR…: el día no existe en ese mes (29FEB solo en bisiestos)
    if (new Date(year, month - 1, day).getDate() !== day) {
      return { error: 'Fecha no válida: ' + dateM[0] + ' no existe en ' + year, raw: raw };
    }
    var fechaISO = year + '-' + pad(month) + '-' + pad(day);

    var origenCode = routeM[1];
    var destinoCode = routeM[2];
    if (origenCode === destinoCode) {
      return { error: 'Origen y destino son el mismo aeropuerto (' + origenCode + ').', raw: raw };
    }
    var salida = normalizeTime(times[1]);
    var llegada = normalizeTime(times[2]);
    if (!salida || !llegada) return { error: 'Horas no válidas: ' + times[0], raw: raw };
    // Llega "antes" de salir: solo es posible si aterriza al día siguiente.
    // Con "+1" en la línea es explícito; sin él, se avisa para revisarlo.
    var avisos = [];
    if (llegada < salida && !times[3]) avisos.push('la llegada es anterior a la salida: ¿llega al día siguiente?');

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
      llegaDiaSiguiente: llegada < salida,
      avisos: avisos,
      raw: raw
    };
  }

  return {
    AIRLINES: AIRLINES,
    AIRLINES_SIN_IATA: AIRLINES_SIN_IATA,
    AIRPORTS: AIRPORTS,
    nombresAerolineas: nombresAerolineas,
    parseFlightLine: parseFlightLine
  };
});
