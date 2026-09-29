(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Exporter = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  'use strict';

  var VERSION_APP = '1.0.0';

  // Esquema §3: exportación/importación de catálogo
  function buildExport(plantillas) {
    return {
      versionApp: VERSION_APP,
      fechaExportacion: new Date().toISOString(),
      totalPlantillas: (plantillas || []).length,
      plantillas: (plantillas || []).map(function (p) {
        return {
          id: p.id,
          nombrePosada: p.nombrePosada,
          destino: p.destino,
          tipoServicioDefault: p.tipoServicioDefault || '',
          layoutFotos: Number(p.layoutFotos),
          imagenesBase64: (p.imagenesBase64 || []).slice(),
          inclusiones: (p.inclusiones || []).slice(),
          fechaCreacion: p.fechaCreacion || '',
        };
      }),
    };
  }

  function validateFile(obj) {
    var errors = [];
    if (!obj || typeof obj !== 'object') { errors.push('Archivo inválido'); return { ok: false, errors: errors }; }
    if (!Array.isArray(obj.plantillas)) errors.push('Falta el arreglo "plantillas"');
    if (obj.totalPlantillas !== undefined && Number(obj.totalPlantillas) !== obj.plantillas.length) {
      errors.push('totalPlantillas no coincide con el número real de plantillas');
    }
    var ids = {};
    (obj.plantillas || []).forEach(function (p) {
      if (!p || !p.id) { errors.push('Plantilla sin id'); return; }
      if (ids[p.id]) errors.push('Id duplicado en el archivo: ' + p.id);
      ids[p.id] = true;
    });
    return { ok: errors.length === 0, errors: errors };
  }

  // Devuelve {nuevas, reemplazables} y plan por id
  function planificarImport(existing, incoming) {
    var existingIds = {};
    (existing || []).forEach(function (p) { existingIds[p.id] = p; });

    var plan = {
      nuevas: [],
      reemplazables: [],
      decisiones: {}, // id -> 'reemplazar' | 'omitir'
    };

    (incoming || []).forEach(function (p) {
      if (existingIds[p.id]) {
        plan.reemplazables.push(p);
      } else {
        plan.nuevas.push(p);
      }
    });
    return plan;
  }

  // excluirIds: ids presentes que NO se deben reemplazar (se conserva el existente)
  function aplicarImport(existing, incoming, excluirIds) {
    var ex = excluirIds || [];
    var byId = {};
    (incoming || []).forEach(function (p) { byId[p.id] = p; });

    var acc = (existing || []).map(function (p) {
      var n = byId[p.id];
      if (n && ex.indexOf(p.id) === -1) return n;
      return p;
    });

    (incoming || []).forEach(function (p) {
      var yaExiste = (existing || []).some(function (e) { return e.id === p.id; });
      if (!yaExiste && ex.indexOf(p.id) === -1) acc.push(p);
    });

    return acc;
  }

  return {
    VERSION_APP: VERSION_APP,
    buildExport: buildExport,
    validateFile: validateFile,
    planificarImport: planificarImport,
    aplicarImport: aplicarImport,
  };
});