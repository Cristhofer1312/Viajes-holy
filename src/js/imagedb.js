(function (root) {
  'use strict';

  // Sin límite de peso: las fotos se guardan en el bucket de Supabase
  // en calidad original. Este módulo queda como puente de lectura
  // (File -> dataURL) para no romper a sus llamadores.

  function leerArchivoComoDataURL(file) {
    return new Promise(function (resolve, reject) {
      if (typeof FileReader === 'undefined') {
        reject(new Error('FileReader no disponible'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('No se pudo leer el archivo')); };
      reader.readAsDataURL(file);
    });
  }

  function leerBlobComoDataURL(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(new Error('No se pudo leer la imagen')); };
      reader.readAsDataURL(blob);
    });
  }

  // Devuelve el dataURL original del archivo, sin comprimir ni redimensionar.
  function comprimirDesdeFile(file) {
    return leerArchivoComoDataURL(file);
  }

  // Compat: si ya es dataURL lo devuelve tal cual; si es URL http(s),
  // la descarga y la convierte a dataURL sin tocar su calidad.
  function comprimirDesdeSrc(src) {
    if (/^data:/.test(String(src || ''))) return Promise.resolve(src);
    return fetch(src).then(function (r) {
      if (!r.ok) throw new Error('No se pudo leer la imagen');
      return r.blob();
    }).then(leerBlobComoDataURL);
  }

  root.ImageDB = {
    comprimirDesdeFile: comprimirDesdeFile,
    comprimirDesdeSrc: comprimirDesdeSrc,
  };
})(typeof self !== 'undefined' ? self : this);
