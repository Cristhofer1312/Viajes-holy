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

    // MODO NAVEGADOR: aviso + imprimir
    root.toast?.('ℹ️ Usa el .exe para guardar. Abriendo diálogo de impresión…');
    return imprimir();
  }

  function imprimir() {
    document.body.classList.add('printing');
    var p = new Promise(function (resolve) {
      var restaurar = function () {
        document.body.classList.remove('printing');
        resolve();
      };
      window.setTimeout(function () {
        try {
          window.print();
        } finally {
          restaurar();
        }
      }, 50);
    });
    return p;
  }

  root.PdfManager = {
    guardarPDF: guardarPDF,
    imprimir: imprimir,
  };
})(typeof self !== 'undefined' ? self : this);