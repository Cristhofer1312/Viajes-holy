const test = require('node:test');
const assert = require('node:assert/strict');
const { parseFlightLine } = require('../src/js/flightParser.js');

const TODAY = new Date(2026, 8, 29); // 29 SEP 2026

test('ejemplo del usuario: CV 23OCT CCS->LRV', () => {
  const r = parseFlightLine('CV1723M 23OCT FR CCSLRV SS1   0945 1025', { today: TODAY });
  assert.equal(r.error, undefined);
  assert.equal(r.aerolineaCode, 'CV');
  assert.equal(r.aerolinea, 'AEROCARIBE');
  assert.equal(r.fechaISO, '2026-10-23');
  assert.equal(r.origenCode, 'CCS');
  assert.equal(r.destinoCode, 'LRV');
  assert.equal(r.origen, 'CARACAS');
  assert.equal(r.destino, 'LOS ROQUES');
  assert.equal(r.salida, '09:45');
  assert.equal(r.llegada, '10:25');
});

test('retorno con V0 resuelve CONVIASA', () => {
  const r = parseFlightLine('V01234 24OCT SA LRVCCS HK1 1100 1150', { today: TODAY });
  assert.equal(r.aerolinea, 'CONVIASA');
  assert.equal(r.fechaISO, '2026-10-24');
  assert.equal(r.origen, 'CARACAS'.replace('CARACAS', 'LOS ROQUES'));
  assert.equal(r.salida, '11:00');
  assert.equal(r.llegada, '11:50');
});

test('minúsculas y espacios extra', () => {
  const r = parseFlightLine('  ql123  05nov  mo  ccs lrv  ss1  0945  1025 ', { today: TODAY });
  assert.equal(r.aerolinea, 'LASER AIRLINES');
  assert.equal(r.fechaISO, '2026-11-05');
  assert.equal(r.salida, '09:45');
});

test('fecha pasada rota al año siguiente', () => {
  const r = parseFlightLine('ES100 10JAN MO CCSLRV SS1 0800 0900', { today: TODAY });
  assert.equal(r.fechaISO, '2027-01-10');
});

test('codigo no registrado se conserva', () => {
  const r = parseFlightLine('XX999 23OCT FR CCSLRV SS1 0945 1025', { today: TODAY });
  assert.equal(r.aerolinea, 'XX');
  assert.equal(r.aerolineaRegistrada, false);
});

test('nuevas aerolíneas: T9, G0, O3, DO, 9R y WW', () => {
  const casos = [
    ['T9172 23OCT FR CCSLRV SS1 0945 1025', 'TURPIAL AIRLINES'],
    ['G0100 23OCT FR CCSLRV SS1 0945 1025', 'ALBATROS'],
    ['O3100 23OCT FR CCSLRV SS1 0945 1025', 'SASCA AIRLINES'],
    ['DO100 23OCT FR CCSLRV SS1 0945 1025', 'SKY HIGH'],
    ['9R100 23OCT FR CCSLRV SS1 0945 1025', 'SATENA'],
    ['WW100 23OCT FR CCSLRV SS1 0945 1025', 'VENEZOLANA (RAVSA)'],
  ];
  for (const [txt, nombre] of casos) {
    assert.equal(parseFlightLine(txt, { today: TODAY }).aerolinea, nombre);
  }
});

test('aeropuertos nacionales: PMV, MAR, CAJ', () => {
  const ida = parseFlightLine('CV1723M 23OCT FR CCSPMV SS1 0945 1105', { today: TODAY });
  assert.equal(ida.destino, 'PORLAMAR');
  const ret = parseFlightLine('V0124 24OCT SA CAJCCS HK1 0800 0930', { today: TODAY });
  assert.equal(ret.origen, 'CANAIMA');
  assert.equal(ret.destino, 'CARACAS');
  const vig = parseFlightLine('QL200 25OCT SU MARVLN HK1 0700 0800', { today: TODAY });
  assert.equal(vig.origen, 'MARACAIBO');
  assert.equal(vig.destino, 'VALENCIA');
});

test('aerolíneas venezolanas actuales, con alias de códigos antiguos', () => {
  const casos = {
    V0: 'CONVIASA', '9V': 'AVIOR AIRLINES', QL: 'LASER AIRLINES', ES: 'ESTELAR AIRLINES',
    RU: 'RUTACA AIRLINES', '5R': 'RUTACA AIRLINES', T9: 'TURPIAL AIRLINES', O3: 'SASCA AIRLINES',
    CV: 'AEROCARIBE', CW: 'AEROPOSTAL', VH: 'AEROPOSTAL', WW: 'VENEZOLANA (RAVSA)', G0: 'ALBATROS',
  };
  for (const [code, nombre] of Object.entries(casos)) {
    const r = parseFlightLine(`${code}123 23OCT FR CCSPMV SS1 0945 1025`, { today: TODAY });
    assert.equal(r.aerolinea, nombre, code);
    assert.equal(r.aerolineaRegistrada, true, code);
  }
});

test('formato Amadeus/KIU: número de tramo, clase y datos tras las horas', () => {
  const r = parseFlightLine('1 V0 1234 Y 23OCT 5 CCSLRV HK2 0945 1025 23OCT E V0/ABC123', { today: TODAY });
  assert.equal(r.error, undefined);
  assert.equal(r.aerolinea, 'CONVIASA');
  assert.equal(r.numeroVuelo, '1234');
  assert.equal(r.origen, 'CARACAS');
  assert.equal(r.destino, 'LOS ROQUES');
  assert.equal(r.salida, '09:45');
  assert.equal(r.llegada, '10:25');
  const t = parseFlightLine('2. RU 0402 23OCT CCSPMV SS1 2215 0010+1', { today: TODAY });
  assert.equal(t.aerolinea, 'RUTACA AIRLINES');
  assert.equal(t.salida, '22:15');
  assert.equal(t.llegada, '00:10');
});

test('aeropuertos agregados y Las Piedras con su código real', () => {
  const r = parseFlightLine('9V200 25OCT SU CCSLSP HK1 0700 0800', { today: TODAY });
  assert.equal(r.destino, 'LAS PIEDRAS');
  assert.equal(parseFlightLine('QL300 25OCT SU CZEVLV HK1 0700 0800', { today: TODAY }).origen, 'CORO');
  assert.equal(parseFlightLine('CM300 25OCT SU CCSPTY HK1 0700 0800', { today: TODAY }).destino, 'PANAMA');
});

test('nombresAerolineas: sin repetidos e incluye chárter sin IATA', () => {
  const { nombresAerolineas } = require('../src/js/flightParser.js');
  const n = nombresAerolineas();
  assert.equal(new Set(n).size, n.length);
  assert.ok(n.includes('RUTACA AIRLINES'));
  assert.ok(n.includes('BLUESTAR AVIATION'));
});

test('fechas que no existen y rutas imposibles se rechazan', () => {
  assert.match(parseFlightLine('CV1723M 31FEB FR CCSLRV SS1 0945 1025', { today: TODAY }).error, /no existe/);
  assert.match(parseFlightLine('CV1723M 31APR FR CCSLRV SS1 0945 1025', { today: TODAY }).error, /no existe/);
  assert.match(parseFlightLine('CV1723M 23OCT FR CCSCCS SS1 0945 1025', { today: TODAY }).error, /mismo aeropuerto/);
  // 29FEB: 2027 no es bisiesto, 2028 sí
  assert.ok(parseFlightLine('CV1 29FEB FR CCSLRV SS1 0945 1025', { today: new Date(2027, 0, 5) }).error);
  assert.equal(parseFlightLine('CV1 29FEB FR CCSLRV SS1 0945 1025', { today: new Date(2028, 0, 5) }).fechaISO, '2028-02-29');
});

test('texto inválido devuelve error', () => {
  const r = parseFlightLine('hola mundo', { today: TODAY });
  assert.ok(r.error);
});

test('fechas imposibles se rechazan con un mensaje claro', () => {
  for (const f of ['31FEB', '30FEB', '31APR', '32JAN']) {
    const r = parseFlightLine(`CV1723M ${f} FR CCSLRV SS1 0945 1025`, { today: TODAY });
    assert.ok(r.error, f);
  }
  assert.equal(parseFlightLine('CV1723M 28FEB FR CCSLRV SS1 0945 1025', { today: TODAY }).error, undefined);
});

test('mismo origen y destino se rechaza', () => {
  assert.ok(parseFlightLine('CV1723M 23OCT FR CCSCCS SS1 0945 1025', { today: TODAY }).error);
});

test('llegada anterior a la salida: aviso, salvo que traiga +1', () => {
  const r = parseFlightLine('CV1723M 23OCT FR CCSLRV SS1 1025 0945', { today: TODAY });
  assert.equal(r.error, undefined);
  assert.equal(r.avisos.length, 1);
  const n = parseFlightLine('RU402 23OCT CCSPMV SS1 2215 0010+1', { today: TODAY });
  assert.deepEqual(n.avisos, []);
  assert.equal(n.llegaDiaSiguiente, true);
  assert.deepEqual(parseFlightLine('CV1723M 23OCT FR CCSLRV SS1 0945 1025', { today: TODAY }).avisos, []);
});
