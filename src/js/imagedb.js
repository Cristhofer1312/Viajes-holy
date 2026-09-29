(function (root) {
  'use strict';

  var MAX_BYTES = 500 * 1024; // 500 KB
  var MAX_DIM = 1280;         // dimensión mayor del lienzo
  var INITIAL_Q = 0.82;

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { reject(new Error('No se pudo leer la imagen')); };
      img.src = src;
    });
  }

  function calcularDimensiones(w, h) {
    var m = Math.max(w, h);
    if (m <= MAX_DIM) return { w: w, h: h };
    var r = MAX_DIM / m;
    return { w: Math.round(w * r), h: Math.round(h * r) };
  }

  function pintarYComprimir(img, calidad) {
    var dim = calcularDimensiones(img.naturalWidth || img.width, img.naturalHeight || img.height);
    var canvas = document.createElement('canvas');
    canvas.width = dim.w;
    canvas.height = dim.h;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dim.w, dim.h);
    ctx.drawImage(img, 0, 0, dim.w, dim.h);
    return canvas.toDataURL('image/jpeg', calidad);
  }

  function comprimirDesdeSrc(src) {
    return loadImage(src).then(function (img) {
      var dataUrl = pintarYComprimir(img, INITIAL_Q);
      var partes = dataUrl.split(',');
      var bytes = Math.floor(partes[1].length * 3 / 4);

      if (bytes <= MAX_BYTES) return dataUrl;

      var calidad = INITIAL_Q;
      for (var i = 0; i < 6; i++) {
        calidad = calidad - 0.12;
        if (calidad < 0.3) break;
        dataUrl = pintarYComprimir(img, calidad);
        partes = dataUrl.split(',');
        bytes = Math.floor(partes[1].length * 3 / 4);
        if (bytes <= MAX_BYTES) return dataUrl;
      }
      return dataUrl; // mejor esfuerzo
    });
  }

  function comprimirDesdeFile(file) {
    return new Promise(function (resolve, reject) {
      var dataUrl = null;
      if (typeof FileReader !== 'undefined') {
        var reader = new FileReader();
        reader.onload = function () {
          dataUrl = reader.result;
          comprimirDesdeSrc(dataUrl).then(resolve, reject);
        };
        reader.onerror = function () { reject(new Error('No se pudo leer el archivo')); };
        reader.readAsDataURL(file);
      } else {
        reject(new Error('FileReader no disponible'));
      }
    });
  }

  root.ImageDB = {
    MAX_BYTES: MAX_BYTES,
    comprimirDesdeFile: comprimirDesdeFile,
    comprimirDesdeSrc: comprimirDesdeSrc,
  };
})(typeof self !== 'undefined' ? self : this);