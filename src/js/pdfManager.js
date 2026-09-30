(function (root) {
  'use strict';

  // ── Selectores de modales/overlays que NO deben aparecer en el PDF.
  // Se ocultan por style inline (máxima prioridad) ANTES de abrir el diálogo.
  var MODAL_SELECTORS = [
    '#modal-mi-cuenta',
    '#modal-posada',
    '#modal-usuario',
    '#modal-usuario-editar',
    '#confirm-modal',
    '#import-modal',
    '#menu-overlay',
    '#login-overlay',
    '#sidebar',
    'aside',
    '#q-posada-list',
    '#toast',
    '.toast',
  ];

  // ── CSS que se inyecta dinámicamente al final de <head> justo antes de
  // imprimir. Al estar DESPUÉS de los estilos de Tailwind CDN (que se
  // inyectan via JS en un <style> propio), esta hoja gana todas las
  // colisiones de especificidad aunque ambas usen !important.
  // Esto es lo que resuelve las hojas en blanco: anula el h-screen /
  // min-h-screen / overflow-hidden del body y colapsa los paddings de los
  // contenedores intermedios.
  var PRINT_OVERRIDE_CSS = [
    '@media print {',
    // body: anula h-screen, h-dvh, min-h-screen, overflow-hidden, flex
    '  html, body {',
    '    display: block !important;',
    '    height: auto !important;',
    '    min-height: 0 !important;',
    '    max-height: none !important;',
    '    overflow: visible !important;',
    '    width: 210mm !important;',
    '    padding: 0 !important;',
    '    margin: 0 !important;',
    '  }',
    // app-shell y su wrapper flex directo
    '  #app-shell, #app-shell > div {',
    '    display: block !important;',
    '    height: auto !important;',
    '    min-height: 0 !important;',
    '    max-height: none !important;',
    '    overflow: visible !important;',
    '    padding: 0 !important;',
    '    margin: 0 !important;',
    '  }',
    // main y las secciones de vista
    '  main, section.view, section.view > div {',
    '    display: block !important;',
    '    height: auto !important;',
    '    min-height: 0 !important;',
    '    max-height: none !important;',
    '    overflow: visible !important;',
    '    padding: 0 !important;',
    '    margin: 0 !important;',
    '    gap: 0 !important;',
    '  }',
    // preview-stage y scale-box: quitar padding p-3/p-4
    '  .preview-stage, .scale-box {',
    '    overflow: visible !important;',
    '    height: auto !important;',
    '    padding: 0 !important;',
    '    margin: 0 !important;',
    '  }',
    // Ocultar todo lo que no debe imprimirse
    '  .no-print, .form-panel, aside,',
    '  #login-overlay, #menu-overlay,',
    '  [id^="modal-"], .hidden {',
    '    display: none !important;',
    '  }',
    // page-sheet: tamaño A4 fijo.
    // OJO: el corte de página NO va en .page-sheet (cada hoja es hija
    // única de su .scale-box, así que :last-child casaba con TODAS y
    // anulaba el break de la primera). El corte va en .preview-item
    // (fallback sin aislamiento) o en #holy-print-root .page-sheet
    // (ruta normal con aislamiento, donde sí son hermanas).
    '  .preview-item {',
    '    display: block !important;',
    '    width: auto !important;',
    '    height: auto !important;',
    '    overflow: visible !important;',
    '    padding: 0 !important;',
    '    margin: 0 !important;',
    '    page-break-after: always !important;',
    '    break-after: page !important;',
    '  }',
    '  .preview-item:last-child {',
    '    page-break-after: auto !important;',
    '    break-after: auto !important;',
    '  }',
    '  .page-sheet {',
    '    display: flex !important;',
    '    width: 210mm !important;',
    '    height: 297mm !important;',
    '    min-height: 297mm !important;',
    '    max-height: 297mm !important;',
    '    box-shadow: none !important;',
    '    margin: 0 !important;',
    '    border-radius: 0 !important;',
    '    page-break-after: auto !important;',
    '    break-after: auto !important;',
    '    box-sizing: border-box !important;',
    '    overflow: hidden !important;',
    '  }',
    // Contenedor de aislamiento (creado por aislarHojasParaPrint):
    // únicas hojas hermanas → aquí :last-child sí funciona.
    '  #holy-print-root {',
    '    display: block !important;',
    '    padding: 0 !important;',
    '    margin: 0 !important;',
    '  }',
    '  #holy-print-root .page-sheet {',
    '    page-break-after: always !important;',
    '    break-after: page !important;',
    '  }',
    '  #holy-print-root .page-sheet:last-child {',
    '    page-break-after: auto !important;',
    '    break-after: auto !important;',
    '  }',
    '  .page-sheet:last-child {',
    '    page-break-after: auto !important;',
    '    break-after: auto !important;',
    '  }',
    '}',
  ].join('\n');

  // Inyecta el <style> override al final de <head> y devuelve función para
  // eliminarlo (se llama en afterprint).
  function inyectarEstilosPrint() {
    var el = document.getElementById('holy-print-override');
    if (el) el.parentNode.removeChild(el);
    var style = document.createElement('style');
    style.id = 'holy-print-override';
    style.textContent = PRINT_OVERRIDE_CSS;
    document.head.appendChild(style);
    return function () {
      var s = document.getElementById('holy-print-override');
      if (s) s.parentNode.removeChild(s);
    };
  }

  // Oculta modales via style inline (gana sobre cualquier hoja de estilos).
  function ocultarModalesParaPrint() {
    var restauraciones = [];
    var vistos = [];
    MODAL_SELECTORS.forEach(function (sel) {
      document.querySelectorAll(sel).forEach(function (el) {
        // Un mismo elemento puede casar con varios selectores
        // (ej. #toast + .toast): procesarlo una sola vez para que la
        // restauración no se pise a sí misma y lo deje oculto.
        if (vistos.indexOf(el) !== -1) return;
        vistos.push(el);
        var prevDisplay = el.style.display;
        var prevVisibility = el.style.visibility;
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        restauraciones.push(function () {
          el.style.display = prevDisplay;
          el.style.visibility = prevVisibility;
        });
      });
    });
    return function () {
      restauraciones.forEach(function (fn) { try { fn(); } catch (e) {} });
    };
  }

  // Fuerza estilos inline en la cadena body→app-shell→main para anular
  // clases Tailwind de altura/overflow que generan hojas en blanco.
  function fijarLayoutParaPrint() {
    var CHAIN = ['body', '#app-shell', '#app-shell > div', 'main'];
    var restauraciones = [];
    CHAIN.forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el) return;
      var prev = {
        display: el.style.display,
        height: el.style.height,
        minHeight: el.style.minHeight,
        maxHeight: el.style.maxHeight,
        overflow: el.style.overflow,
        padding: el.style.padding,
        margin: el.style.margin,
      };
      el.style.setProperty('display', 'block', 'important');
      el.style.setProperty('height', 'auto', 'important');
      el.style.setProperty('min-height', '0', 'important');
      el.style.setProperty('max-height', 'none', 'important');
      el.style.setProperty('overflow', 'visible', 'important');
      el.style.setProperty('padding', '0', 'important');
      el.style.setProperty('margin', '0', 'important');
      restauraciones.push(function () {
        el.style.display = prev.display;
        el.style.height = prev.height;
        el.style.minHeight = prev.minHeight;
        el.style.maxHeight = prev.maxHeight;
        el.style.overflow = prev.overflow;
        el.style.padding = prev.padding;
        el.style.margin = prev.margin;
      });
    });
    return function () {
      restauraciones.forEach(function (fn) { try { fn(); } catch (e) {} });
    };
  }

  // ── Aislamiento: mueve las hojas de la vista visible a un contenedor
  // raíz temporal (#holy-print-root) para que NADA más (toolbars,
  // sidebars, overlays fixed, paddings/gaps del grid, stages ocultos,
  // alturas inline de fitStage) pueda reservar páginas en blanco ANTES
  // del contenido. Al terminar se devuelve cada hoja a su lugar exacto
  // y se restaura todo. Devuelve función restauradora.
  function aislarHojasParaPrint() {
    var vista = null;
    document.querySelectorAll('section.view').forEach(function (s) {
      if (!vista && !s.classList.contains('hidden')) vista = s;
    });
    var ambito = vista || document;
    var hojas = ambito.querySelectorAll('.page-sheet');
    if (!hojas || !hojas.length) return function () {};
    var rootPrint = document.createElement('div');
    rootPrint.id = 'holy-print-root';
    document.body.appendChild(rootPrint);
    var movidas = [];
    hojas.forEach(function (h) {
      movidas.push({ el: h, parent: h.parentNode, next: h.nextSibling });
      rootPrint.appendChild(h);
    });
    // Oculta el resto de hijos directos de body con inline !important:
    // gana a cualquier utilidad Tailwind sin importar el orden de hojas.
    // (#holy-print-root queda como único hijo visible.)
    var ocultos = [];
    Array.prototype.forEach.call(document.body.children, function (child) {
      if (child === rootPrint) return;
      if (child.tagName === 'SCRIPT') return;
      var prevDisplay = child.style.display;
      var prevVisibility = child.style.visibility;
      var prevPosition = child.style.position;
      child.style.setProperty('display', 'none', 'important');
      child.style.setProperty('visibility', 'hidden', 'important');
      child.style.setProperty('position', 'static', 'important');
      ocultos.push(function () {
        child.style.display = prevDisplay;
        child.style.visibility = prevVisibility;
        child.style.position = prevPosition;
      });
    });
    return function () {
      movidas.forEach(function (m) {
        try {
          if (m.next && m.next.parentNode === m.parent) m.parent.insertBefore(m.el, m.next);
          else m.parent.appendChild(m.el);
        } catch (e) { try { m.parent.appendChild(m.el); } catch (e2) {} }
      });
      ocultos.forEach(function (fn) { try { fn(); } catch (e) {} });
      if (rootPrint.parentNode) rootPrint.parentNode.removeChild(rootPrint);
    };
  }

  // Abstraccción de salida PDF:
  //  - Electron: root.holy.api.savePdf() → guarda directo a disco con diálogo nativo.
  //  - Navegador: window.print() con nota para "Guardar como PDF".
  function prepararPrint() {
    if (root.ocultarToast) root.ocultarToast();
    var toastEl = document.getElementById('toast');
    if (toastEl) toastEl.classList.remove('show');
    // El PDF siempre debe llevar las 2 páginas.
    var restaurarPaginas = null;
    try {
      if (typeof root.forzarAmbasParaPrint === 'function') {
        restaurarPaginas = root.forzarAmbasParaPrint();
      }
    } catch (e) { restaurarPaginas = null; }
    return restaurarPaginas || function () {};
  }

  function guardarPDF() {
    if (root.holy && root.holy.api && root.holy.api.savePdf) {
      var restaurarElectron = prepararPrint();
      var restaurarModalesElectron = ocultarModalesParaPrint();
      var restaurarEstilosElectron = inyectarEstilosPrint();
      var restaurarLayoutElectron = fijarLayoutParaPrint();
      // El aislamiento va ÚLTIMO: captura los estados ya ocultos como
      // "previos", y al restaurar se deshace PRIMERO (orden LIFO).
      // Si se creara antes, ocultarModales/fijarLayout capturarían el
      // display:none del aislamiento y lo re-aplicarían al restaurar,
      // dejando #app-shell invisible tras imprimir.
      var restaurarAislarElectron = aislarHojasParaPrint();
      return root.holy.api.savePdf().then(function (ruta) {
        if (ruta) root.toast?.('✅ PDF guardado en: ' + ruta);
      }).catch(function (e) {
        root.toast?.('❌ Error al guardar PDF: ' + e.message);
      }).then(function () {
        try { restaurarAislarElectron(); } catch (e) {}
        restaurarLayoutElectron();
        restaurarEstilosElectron();
        restaurarModalesElectron();
        restaurarElectron();
      });
    }
    return imprimir();
  }

  function imprimir() {
    document.body.classList.add('printing');
    var restaurarPaginas = prepararPrint();
    var restaurarModales = ocultarModalesParaPrint();
    // Inyectar estilos override DESPUÉS de Tailwind → gana la cascade
    var restaurarEstilos = inyectarEstilosPrint();
    // Forzar layout inline en la cadena de contenedores críticos
    var restaurarLayout = fijarLayoutParaPrint();
    // Aislamiento al final (ver comentario en guardarPDF).
    var restaurarAislar = aislarHojasParaPrint();

    var p = new Promise(function (resolve) {
      var done = false;
      var restaurar = function () {
        if (done) return;
        done = true;
        document.body.classList.remove('printing');
        // Orden LIFO: el aislamiento se deshace primero porque fue lo
        // último en aplicarse (capturó los ocultamientos previos).
        try { restaurarAislar(); } catch (e) {}
        try { restaurarLayout(); } catch (e) {}
        try { restaurarEstilos(); } catch (e) {}
        try { restaurarModales(); } catch (e) {}
        try { restaurarPaginas(); } catch (e) {}
        resolve();
      };
      window.addEventListener('afterprint', restaurar, { once: true });
      // El timeout da al navegador 350ms para repintar con los nuevos estilos
      // antes de abrir el diálogo de impresión.
      window.setTimeout(function () {
        try {
          window.print();
        } finally {
          // Fallback por si afterprint no dispara en ese navegador
          window.setTimeout(restaurar, 1000);
        }
      }, 350);
    });
    return p;
  }

  root.PdfManager = {
    guardarPDF: guardarPDF,
    imprimir: imprimir,
  };
})(typeof self !== 'undefined' ? self : this);