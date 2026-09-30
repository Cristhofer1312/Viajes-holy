// Verifica que la página 2 de SOLO VUELO no mencione la posada y que
// PAQUETE COMPLETO siga intacto. Uso: node test/solovuelo-page2-check.cjs
const fs = require('fs');
const vm = require('vm');
const base = 'C:\\Users\\Cristhofer Leon\\OneDrive\\Escritorio\\Viajes-holy\\src\\js';

const Monext = require(base + '\\quoteModel.js');
const sandbox = { self: { Monext }, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(base + '\\preview.js', 'utf8'), sandbox);
const Preview = sandbox.self.Preview;

const t = {
  nombrePosada: 'POSADA CORALES XX',
  destino: 'LOS ROQUES ZZ',
  tipoServicioDefault: 'PENSIÓN COMPLETA',
  inclusiones: ['Traslado', 'Desayuno'],
  imagenesBase64: [],
  layoutFotos: 1,
};

function quoteSoloVuelo() {
  return {
    tipoPaquete: 'SOLO VUELO',
    estado: 'COTIZACIÓN',
    fechaCotizacion: '20 SEP 26',
    idCotizacion: 'COT-2026-0920',
    vuelo: {
      aerolinea: 'CONVIASA QQ',
      pnr: 'ABC123',
      dinamicos: [
        { tipo: 'IDA', origen: 'CARACAS', destino: 'LOS ROQUES', fecha: 'LUN, 20 OCT', salida: '0945', llegada: '1025' },
        { tipo: 'RETORNO', origen: 'LOS ROQUES', destino: 'CARACAS', fecha: 'MIE, 22 OCT', salida: '1100', llegada: '1140' },
      ],
      ida: {}, retorno: {},
    },
    pasajeros: { adultos: 2, ninos: 1, infantes: 0 },
    tarifas: { tarifaPorAdulto: 605, tarifaPorNino: 300, montoTotal: 1510, moneda: 'USD' },
  };
}
function quoteCompleto() {
  const q = quoteSoloVuelo();
  q.tipoPaquete = 'PAQUETE COMPLETO';
  q.hospedaje = { checkIn: 'LUN, 20 OCT', checkInHora: '15:00', checkOut: 'MIE, 22 OCT', checkOutHora: '13:00', dias: 3, noches: 2 };
  return q;
}

let fail = 0;
function check(nombre, cond) {
  console.log((cond ? 'PASS' : 'FAIL') + ' ' + nombre);
  if (!cond) fail++;
}

// 1. SOLO VUELO página 2: sin posada, con resumen aéreo
const p2solo = Preview.renderPage2(t, quoteSoloVuelo());
check('solo-vuelo p2 sin nombre posada', !p2solo.includes('POSADA CORALES XX'));
check('solo-vuelo p2 sin destino posada', !p2solo.includes('LOS ROQUES ZZ'));
check('solo-vuelo p2 sin galería', !p2solo.includes('object-cover') || !p2solo.includes('Foto posada'));
check('solo-vuelo p2 encabezado itinerario', p2solo.includes('ITINERARIO DE VUELO'));
check('solo-vuelo p2 aerolínea', p2solo.includes('CONVIASA QQ'));
check('solo-vuelo p2 tramos ida/retorno', p2solo.includes('>IDA<') && p2solo.includes('>RETORNO<'));
check('solo-vuelo p2 PNR', p2solo.includes('ABC123'));
check('solo-vuelo p2 total', p2solo.includes('$1,510'));
check('solo-vuelo p2 mantiene id page2 y A4', p2solo.includes('id="page2"') && p2solo.includes('page-sheet'));

// 2. SOLO VUELO página 1: sigue sin sección POSADA
const p1solo = Preview.renderPage1(t, quoteSoloVuelo());
check('solo-vuelo p1 sin POSADA:', !p1solo.includes('POSADA:'));
check('solo-vuelo p1 con AÉREO:', p1solo.includes('AÉREO:'));

// 3. PAQUETE COMPLETO intacto
const p2comp = Preview.renderPage2(t, quoteCompleto());
check('completo p2 con posada', p2comp.includes('POSADA CORALES XX'));
check('completo p2 con galería/fotos', p2comp.includes('grid'));
const p1comp = Preview.renderPage1(t, quoteCompleto());
check('completo p1 con POSADA:', p1comp.includes('POSADA:'));

// 4. SOLO VUELO sin dinámicos (ida/retorno fijos) no rompe
const qFijo = quoteSoloVuelo();
qFijo.vuelo.dinamicos = [];
qFijo.vuelo.ida = { origen: 'CCS', destino: 'LRV', fecha: 'LUN', salida: '09:00', llegada: '10:00' };
qFijo.vuelo.retorno = { origen: 'LRV', destino: 'CCS', fecha: 'MIE', salida: '11:00', llegada: '12:00' };
const p2fijo = Preview.renderPage2(t, qFijo);
check('solo-vuelo p2 ida/retorno fijos', p2fijo.includes('>IDA<') && p2fijo.includes('>RETORNO<') && !p2fijo.includes('POSADA CORALES XX'));

if (fail) { console.log('RESULT: FAIL (' + fail + ')'); process.exit(1); }
console.log('RESULT: PASS');
