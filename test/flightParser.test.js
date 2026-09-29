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

test('texto inválido devuelve error', () => {
  const r = parseFlightLine('hola mundo', { today: TODAY });
  assert.ok(r.error);
});
