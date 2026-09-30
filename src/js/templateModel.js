(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.TemplateModel = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  'use strict';

  var REQUIRED = ['nombrePosada', 'destino', 'layoutFotos', 'imagenesBase64', 'inclusiones'];
  var LAYOUTS = [1, 2, 3, 4];

  function slugify(nombre, destino) {
    var limpiar = function (s) {
      return String(s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    };
    var n = limpiar(nombre).slice(0, 18) || 'posada';
    var d = limpiar(destino).slice(0, 4).replace(/-$/, '') || 'dest';
    n = n.replace(/^posada-?/, '') || 'posada';
    return 'posada-' + n + '-' + d;
  }

  function uniqueId(nombre, destino, existingIds) {
    var base = slugify(nombre, destino);
    var id = base;
    var i = 2;
    while (existingIds.indexOf(id) !== -1) {
      id = base + '-' + i;
      i++;
    }
    return id;
  }

  function validate(t) {
    var errors = [];
    if (!t) { errors.push('Plantilla vacía'); return { ok: false, errors: errors }; }
    REQUIRED.forEach(function (k) {
      if (k === 'imagenesBase64' || k === 'inclusiones') {
        if (!Array.isArray(t[k]) || t[k].length === 0) errors.push('Falta campo: ' + k);
      } else if (t[k] === undefined || t[k] === null || String(t[k]).trim() === '') {
        errors.push('Falta campo: ' + k);
      }
    });
    if (!t.id || String(t.id).trim() === '') errors.push('Falta campo: id');
    if (LAYOUTS.indexOf(Number(t.layoutFotos)) === -1) {
      errors.push('layoutFotos debe ser 1, 2, 3 o 4');
    }
    if (Array.isArray(t.imagenesBase64) && t.imagenesBase64.length > Number(t.layoutFotos)) {
      errors.push('Hay más imágenes que el layout configurado (' + t.layoutFotos + ')');
    }

    return { ok: errors.length === 0, errors: errors };
  }

  function create(data, existingIds) {
    var fecha = new Date().toISOString();
    return {
      id: data.id || uniqueId(data.nombrePosada, data.destino, existingIds || []),
      tipoTemplate: String(data.tipoTemplate || 'COMPLETO').trim().toUpperCase(),
      nombrePosada: String(data.nombrePosada || '').trim(),
      destino: String(data.destino || '').trim(),
      tipoServicioDefault: String(data.tipoServicioDefault || '').trim(),
      layoutFotos: Number(data.layoutFotos) || 1,
      imagenesBase64: Array.isArray(data.imagenesBase64) ? data.imagenesBase64.slice() : [],
      inclusiones: Array.isArray(data.inclusiones) ? data.inclusiones.slice() : [],
      checkInHora: String(data.checkInHora || '15:00'),
      checkOutHora: String(data.checkOutHora || '13:00'),
      fechaCreacion: data.fechaCreacion || fecha,
    };
  }

  function portada(t) {
    return (t && t.imagenesBase64 && t.imagenesBase64.length > 0) ? t.imagenesBase64[0] : '';
  }

  return {
    REQUIRED: REQUIRED,
    LAYOUTS: LAYOUTS,
    slugify: slugify,
    uniqueId: uniqueId,
    validate: validate,
    create: create,
    portada: portada,
  };
});