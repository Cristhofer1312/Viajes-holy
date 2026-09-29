(function (root) {
  'use strict';

  // Abstracción de salida PDF:
  //  - Electron: root.holy.api.savePdf() → guarda directo a disco con diálogo nativo.
  //  - Navegador: window.print() con nota para "Guardar como PDF".
  function guardarPDF() {
    if (root.holy && root.holy.api && root.holy.api.savePdf) {
      // MODO ELECTRON: guardado directo en disco
      return root.holy.api.savePdf().then(function (ruta) {
        if (ruta) {
          root.toast?.('✅ PDF guardado en: ' + ruta);
        }
        // Si ruta es null = el usuario canceló el diálogo, no hacer nada
      }).catch(function (e) {
        root.toast?.('❌ Error al guardar PDF: ' + e.message);
      });
    }

    // MODO NAVEGADOR: imprimir sin toast visible.
    // El toast tapaba la franja "NO INCLUYE" y salía impreso en el PDF
    // porque @media print no lo ocultaba a tiempo. Se oculta antes de
    // abrir el diálogo y se deja repintar antes de window.print().
    if (root.ocultarToast) root.ocultarToast();
    var toastEl = document.getElementById('toast');
    if (toastEl) toastEl.classList.remove('show');
    return imprimir();
  }

  function imprimir() {
    document.body.classList.add('printing');
    if (root.ocultarToast) root.ocultarToast();
    var toastEl = document.getElementById('toast');
    if (toastEl) toastEl.classList.remove('show');
    var p = new Promise(function (resolve) {
      var done = false;
      var restaurar = function () {
        if (done) return;
        done = true;
        document.body.classList.remove('printing');
        resolve();
      };
      window.addEventListener('afterprint', restaurar, { once: true });
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