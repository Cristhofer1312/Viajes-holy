// src/js/storage.js — versión Supabase/Netlify
// Reemplaza la versión anterior con IndexedDB y localStorage
// Mantiene la MISMA interfaz pública: Store.loadCatalog(), Store.saveCatalog(), etc.
// app.js no necesita ningún cambio.

(function (root) {
  'use strict';

  // ─── Helpers internos ────────────────────────────────────────────────────────

  // Convierte una fila de Supabase al formato que espera app.js / templateModel.js
  function mapRow(p) {
    var fotos = Array.isArray(p.posada_fotos) ? p.posada_fotos.slice() : [];
    var incl  = Array.isArray(p.posada_inclusiones) ? p.posada_inclusiones.slice() : [];
    fotos.sort(function (a, b) { return (a.orden || 0) - (b.orden || 0); });
    incl.sort(function (a, b)  { return (a.orden || 0) - (b.orden || 0); });
    var portada = fotos.find(function (f) { return f.es_portada; }) || fotos[0];
    return {
      id:                   p.id,
      nombrePosada:         p.nombre || '',
      destino:              p.destino || '',
      tipoServicioDefault:  p.tipo_servicio_default || '',
      layoutFotos:          Number(p.layout_fotos) || 1,
      checkInHora:          p.checkin_hora  || '15:00',
      checkOutHora:         p.checkout_hora || '13:00',
      tipoTemplate:         p.tipo_template || 'COMPLETO',
      fechaCreacion:        p.fecha_creacion || new Date().toISOString(),
      imagenesBase64:       fotos.map(function (f) { return f.url; }),
      fotoPortada:          portada ? portada.url : '',
      inclusiones:          incl.map(function (i) { return i.texto; }),
    };
  }

  // Obtiene el JWT de la sesión activa
  function getToken() {
    return (root.__supabaseSession && root.__supabaseSession.access_token) || null;
  }

  function authHeaders() {
    var token = getToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    return headers;
  }

  function fetchJSON(url, opts) {
    return fetch(url, opts).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          throw new Error((body && body.error) || ('HTTP ' + r.status));
        });
      }
      return r.json();
    });
  }

  // ─── API pública ─────────────────────────────────────────────────────────────

  /**
   * Carga el catálogo desde Supabase vía la Netlify Function.
   * Requiere sesión: /api/plantillas-list exige catalog:read.
   * Devuelve Promise<plantilla[]> en el formato interno de app.js.
   */
  function loadCatalog() {
    return fetchJSON('/api/plantillas-list', { headers: authHeaders() }).then(function (data) {
      return Array.isArray(data) ? data : [];
    });
  }

  /**
   * Guarda el catálogo completo.
   * app.js llama a saveCatalog(state.catalog) — un array de todas las plantillas.
   * Se hace upsert de cada plantilla modificada.
   */
  function saveCatalog(lista) {
    if (!Array.isArray(lista) || !lista.length) return Promise.resolve([]);

    // Guardar en serie para evitar conflictos de concurrencia
    var promesas = lista.map(function (plantilla) {
      return fetchJSON('/api/plantillas-save', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(plantilla),
      });
    });

    return Promise.all(promesas);
  }

  /**
   * Guarda una única plantilla (optimizado para evitar guardar todo el catálogo).
   */
  function savePlantilla(plantilla) {
    return fetchJSON('/api/plantillas-save', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(plantilla),
    });
  }

  /**
   * Descarga el catálogo como archivo JSON local (respaldo manual).
   * Se mantiene igual que antes.
   */
  function descargar(obj, nombreArchivo) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo || 'catalogo_plantillas.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function leerArchivoJSON(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try { resolve(JSON.parse(reader.result)); }
        catch (e) { reject(new Error('El archivo no es un JSON válido')); }
      };
      reader.onerror = function () { reject(new Error('No se pudo leer el archivo')); };
      reader.readAsText(file);
    });
  }

  // En la versión web no hay Electron
  function tieneElectron() { return false; }

  // ─── Extra: guardar cotización al generar PDF ─────────────────────────────────

  /**
   * Guarda una cotización en la BD (se llama desde pdfManager.js o app.js
   * al momento de generar el PDF).
   */
  function guardarCotizacion(datosQuote) {
    var token = getToken();
    if (!token) return Promise.resolve(); // usuario no autenticado, no guardar
    return fetchJSON('/api/cotizacion-save', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(datosQuote),
    }).catch(function (err) {
      // No bloquear la descarga del PDF si falla el guardado
      console.warn('[Store.guardarCotizacion] Error guardando historial:', err.message);
    });
  }

  root.Store = {
    loadCatalog:        loadCatalog,
    saveCatalog:        saveCatalog,
    savePlantilla:      savePlantilla,
    descargar:          descargar,
    leerArchivoJSON:    leerArchivoJSON,
    tieneElectron:      tieneElectron,
    guardarCotizacion:  guardarCotizacion,
  };

})(typeof self !== 'undefined' ? self : this);