const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/js/quoteModel.js');

test('parseMonto: coma decimal venezolana y formatos comunes', () => {
  const casos = {
    '350,50': 350.5, '350.50': 350.5, '350': 350, '1.234,56': 1234.56, '1,234.56': 1234.56,
    '1.234': 1234, '1,234': 1234, '1.234.567': 1234567, '$ 90': 90, 'Bs. 12,5': 12.5,
    '0,1': 0.1, '0.100': 0.1, '0,100': 0.1, '33.33': 33.33, '': 0, 'abc': 0, '-100': 0, '1e309': 0,
  };
  for (const [txt, esperado] of Object.entries(casos)) assert.equal(M.parseMonto(txt), esperado, txt);
  assert.equal(M.parseMonto(-5), 0);
  assert.equal(M.parseMonto(Infinity), 0);
  assert.equal(M.parseMonto(12.5), 12.5);
});

test('parseCantidad: enteros ≥ 0', () => {
  assert.equal(M.parseCantidad('-2'), 0);
  assert.equal(M.parseCantidad('1.5'), 1);
  assert.equal(M.parseCantidad(''), 0);
  assert.equal(M.parseCantidad('abc'), 0);
  assert.equal(M.parseCantidad('3'), 3);
});

test('buildQuote: nunca da totales negativos y acepta "350,50"', () => {
  assert.equal(M.buildQuote({ adultos: -2, tarifaPorAdulto: 100 }).tarifas.montoTotal, 0);
  assert.equal(M.buildQuote({ adultos: 2, tarifaPorAdulto: -100 }).tarifas.montoTotal, 0);
  const q = M.buildQuote({ adultos: 2, tarifaPorAdulto: '350,50', ninos: 1, tarifaPorNino: '175' });
  assert.equal(q.tarifas.montoTotal, 876);
  assert.equal(q.pasajeros.adultos, 2);
});

test('nochesYDias: fechas invertidas se marcan, no se inventan días', () => {
  assert.deepEqual(M.nochesYDias('2026-12-10', '2026-12-13'), { noches: 3, dias: 4 });
  const inv = M.nochesYDias('2026-12-20', '2026-12-10');
  assert.equal(inv.noches, 0);
  assert.equal(inv.dias, 0);
  assert.equal(inv.invertidas, true);
  assert.equal(M.buildQuote({ checkIn: '2026-12-20', checkOut: '2026-12-10' }).hospedaje.fechasInvertidas, true);
});

test('cada vuelo lleva su aerolínea y el encabezado las resume', () => {
  const q = M.buildQuote({ aerolineaIda: 'AEROCARIBE', aerolineaRetorno: 'LASER AIRLINES' });
  assert.equal(q.vuelo.ida.aerolinea, 'AEROCARIBE');
  assert.equal(q.vuelo.retorno.aerolinea, 'LASER AIRLINES');
  assert.equal(q.vuelo.aerolinea, 'AEROCARIBE / LASER AIRLINES');
  const igual = M.buildQuote({ aerolineaIda: 'CONVIASA', aerolineaRetorno: 'CONVIASA' });
  assert.equal(igual.vuelo.aerolinea, 'CONVIASA');
  const sv = M.buildQuote({ tipoPaquete: 'SOLO VUELO', vuelos: [
    { tipo: 'IDA', aerolinea: 'AVIOR AIRLINES' }, { tipo: 'CONEXIÓN', aerolinea: '' }, { tipo: 'RETORNO', aerolinea: 'RUTACA AIRLINES' }] });
  assert.deepEqual(sv.vuelo.dinamicos.map((d) => d.aerolinea), ['AVIOR AIRLINES', '', 'RUTACA AIRLINES']);
  assert.equal(sv.vuelo.aerolinea, 'AVIOR AIRLINES / RUTACA AIRLINES');
  const tres = M.buildQuote({ vuelos: [{ aerolinea: 'A' }, { aerolinea: 'B' }, { aerolinea: 'C' }] });
  assert.equal(tres.vuelo.aerolinea, 'VARIAS AEROLÍNEAS');
  // compatibilidad: el campo único antiguo sigue sirviendo de valor por defecto
  assert.equal(M.buildQuote({ aerolinea: 'ESTELAR AIRLINES' }).vuelo.ida.aerolinea, 'ESTELAR AIRLINES');
});
