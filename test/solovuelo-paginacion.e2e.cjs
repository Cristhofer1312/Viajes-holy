// test/solovuelo-paginacion.e2e.cjs
// Verifica en un navegador real que la paginación de SOLO VUELO produce hojas
// A4 sin desbordes para 0..14 vuelos y distintos largos de equipaje.
//
// Requiere el servidor corriendo y Playwright:
//   URL=http://127.0.0.1:8090/ node test/solovuelo-paginacion.e2e.cjs
// (en el VPS: docker run --rm --network host -v "$PWD":/w -w /w \
//    mcr.microsoft.com/playwright:v1.49.1-noble \
//    sh -c "npm i --no-save playwright@1.49.1 >/dev/null && node test/solovuelo-paginacion.e2e.cjs")

const { chromium } = require('playwright');
const URL = process.env.URL || 'http://127.0.0.1:8090/';

const EQUIPAJES = {
  'sin equipaje': '',
  '2 líneas': '1 MALETA DE 23KG\n1 BOLSO DE MANO',
  '6 líneas': 'L1\nL2\nL3\nL4\nL5\nL6',
  'línea larga': '1 MALETA DE 23KG POR PASAJERO ADULTO Y NIÑO, MÁS UN ARTÍCULO PERSONAL DEBAJO DEL ASIENTO DELANTERO SIN COSTO ADICIONAL',
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 1400 } });
  await page.goto(URL);
  await page.waitForFunction(() => window.Preview && window.Monext);
  await page.evaluate(() => document.fonts.ready);

  let fallos = 0;
  const resumen = [];
  for (const [nombreEq, equipaje] of Object.entries(EQUIPAJES)) {
    const fila = [];
    for (let n = 0; n <= 14; n++) {
      const r = await page.evaluate(async ({ n, equipaje }) => {
        const vuelos = Array.from({ length: n }, (_, i) => ({
          tipo: i % 2 ? 'RETORNO' : 'IDA', aerolinea: ['AEROCARIBE', 'BOLIVIANA DE AVIACION', 'TURKISH AIRLINES'][i % 3], origen: 'CARACAS', destino: 'LOS ROQUES',
          fecha: '2026-12-10', salida: '09:45', llegada: '10:25', duracion: `V${i + 1}`,
        }));
        const q = Monext.buildQuote({ tipoPaquete: 'SOLO VUELO', pnr: 'FGTYH7', aerolinea: 'AEROCARIBE', equipaje, vuelos, adultos: 2, tarifaPorAdulto: 100 });
        const p = Preview.buildPreview({}, q);
        let box = document.getElementById('t-box');
        if (!box) {
          box = document.createElement('div'); box.id = 't-box';
          box.style.cssText = 'position:absolute;left:0;top:0;z-index:99999;width:794px;background:#fff';
          document.body.appendChild(box);
        }
        box.innerHTML = p.page1 + (p.page2 || '');
        await new Promise((res) => setTimeout(res, 120)); // JIT de Tailwind
        const hojas = [...box.querySelectorAll('.page-sheet')];
        const errores = [];
        const vistos = [];
        hojas.forEach((h, i) => {
          if (h.offsetHeight !== 1123) errores.push(`hoja ${i + 1} mide ${h.offsetHeight}px`);
          const cont = h.firstElementChild;
          if (cont.scrollHeight > cont.clientHeight + 1) errores.push(`hoja ${i + 1} desborda ${cont.scrollHeight - cont.clientHeight}px`);
          const barra = h.lastElementChild.getBoundingClientRect();
          const cierre = h.querySelector('.sv-cierre');
          if (cierre && cierre.getBoundingClientRect().bottom > barra.top + 1) errores.push(`hoja ${i + 1}: cierre pisa la franja`);
          if (cierre && i !== hojas.length - 1) errores.push(`hoja ${i + 1}: cierre fuera de la última hoja`);
          if (Math.abs(barra.bottom - h.getBoundingClientRect().bottom) > 1) errores.push(`hoja ${i + 1}: franja no está al pie`);
          h.querySelectorAll('.sv-vuelos > div').forEach((v) => vistos.push(v.textContent.match(/V\d+/)[0]));
        });
        if (!hojas[hojas.length - 1].querySelector('.sv-cierre')) errores.push('falta el cierre');
        const esperados = Array.from({ length: n }, (_, i) => `V${i + 1}`).join(',');
        if (vistos.join(',') !== esperados) errores.push(`vuelos ${vistos.join(',')} ≠ ${esperados}`);
        const porHoja = hojas.map((h) => h.querySelectorAll('.sv-vuelos > div').length);
        return { hojas: hojas.length, porHoja, errores };
      }, { n, equipaje });
      fila.push(`${n}:${r.porHoja.join('+')}`);
      if (r.errores.length) { fallos++; console.log(`❌ ${nombreEq}, ${n} vuelos → ${r.errores.join(' | ')}`); }
    }
    resumen.push(`${nombreEq.padEnd(13)} ${fila.join('  ')}`);
  }
  console.log('\nVuelos por hoja (n: hoja1+hoja2+…):');
  resumen.forEach((l) => console.log('  ' + l));
  console.log(fallos ? `\n❌ ${fallos} caso(s) con problemas` : '\n✅ 60 casos sin desbordes: hojas A4 exactas, cierre al pie de la última hoja, vuelos completos y en orden');
  await browser.close();
  process.exit(fallos ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
