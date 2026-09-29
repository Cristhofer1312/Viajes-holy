(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };

  var client = window.SupabaseClient;
  var Auth = window.Auth;

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function isoDate(d) {
    var p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  var state = {
    catalog: [],
    view: 'plantillas',
    edit: null,          // plantilla en edición (o null = nueva)
    editImages: [],
    editCover: '',       // foto de portada en edición
    readOnlyCatalogo: false, // true para roles sin template:update
    layout: 4,
    qtTemplate: null,    // plantilla activa en el cotizador
    qt: null,            // cotización actual
    qtPosadaId: '',      // id de posada seleccionada en cotización
    qtDirty: false,
    vuelosDinamicos: [], // Vuelos adicionales para SOLO VUELO
    pendingImport: null, // lista importada esperando decisión
  };

  // ---------------------------------------------------------------- TOAST
  function ocultarToast() {
    var t = $('toast');
    if (t) t.classList.remove('show');
    window.clearTimeout(showToast._timer);
  }

  function showToast(msg, ms) {
    window.clearTimeout(showToast._timer);
    var t = $('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    showToast._timer = window.setTimeout(function () {
      t.classList.remove('show');
    }, ms || 2600);
  }
  showToast._timer = null;
  window.toast = showToast;

  function customConfirm(msg, callback) {
    var modal = $('confirm-modal');
    if (!modal) {
      // Fallback to native if modal not found
      callback(confirm(msg));
      return;
    }

    $('confirm-msg').textContent = msg;
    modal.classList.remove('hidden');

    var yesBtn = $('confirm-yes');
    var noBtn = $('confirm-no');

    // Remove old listeners to avoid firing multiple times
    var newYes = yesBtn.cloneNode(true);
    var newNo = noBtn.cloneNode(true);
    yesBtn.replaceWith(newYes);
    noBtn.replaceWith(newNo);

    newYes.addEventListener('click', function () {
      modal.classList.add('hidden');
      callback(true);
    });

    newNo.addEventListener('click', function () {
      modal.classList.add('hidden');
      callback(false);
    });
  }
  window.ocultarToast = ocultarToast;

  window.addEventListener('error', function (ev) {
    window.console.error('Holy error:', ev.message, ev.filename || '', ev.lineno || '');
    var ahora = Date.now();
    if (ahora - (window._holyLastErr || 0) > 800) {
      window._holyLastErr = ahora;
      showToast('Error: ' + (ev.message || 'desconocido'), 4500);
    }
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason || {};
    window.console.error('Holy promesa:', r && r.message);
    showToast('Promesa: ' + (r && r.message ? r.message : 'desconocido'), 4000);
  });

  // ---------------------------------------------------------------- ROUTER

  // Permiso requerido para entrar a cada vista. null = todos los autenticados.
  // '__oculto__' = oculto para todos (ninguna acción existe con ese nombre y
  // Roles.puede() devuelve false). Para reactivar el Catálogo basta con
  // devolver esta entrada a null: la vista view-catalogo y Exporter siguen intactos.
  var VISTAS_PERMISO = {
    'plantillas':       null,                  // todos
    'cotizacion':       null,                  // todos
    'catalogo':         '__oculto__',          // oculto para todos (decisión de producto)
    'gestion-posadas':  '__oculto__',          // oculto temporalmente a pedido del usuario
    'usuarios':         'user:read',           // encargado / admin
  };

  function vistasPermitidas() {
    return Object.keys(VISTAS_PERMISO).filter(function (v) {
      var p = VISTAS_PERMISO[v];
      return !p || Auth.puede(p);
    });
  }

  function vistaPermitida(v) {
    return vistasPermitidas().indexOf(v) !== -1;
  }

  function setActiveNav(nav) {
    // Nunca navegar a una vista no permitida (p. ej. restaurada de localStorage)
    if (!vistaPermitida(nav)) {
      var permitidas = vistasPermitidas();
      nav = permitidas.indexOf('cotizacion') !== -1 ? 'cotizacion' : permitidas[0];
    }

    document.querySelectorAll('.nav-btn').forEach(function (b) {
      var on = b.dataset.nav === nav;
      b.className = 'nav-btn w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ' +
        (on ? 'bg-white/15 text-white' : 'text-white/80 hover:bg-white/10');
    });
    Object.keys(VISTAS_PERMISO).forEach(function (v) {
      var el = $('view-' + v);
      if (!el) return;
      if (v === nav) el.classList.remove('hidden'); else el.classList.add('hidden');
    });
    state.view = nav;
    localStorage.setItem('holy-active-tab', nav);
    if (nav === 'cotizacion') rebuildCotizacion();
  }

  /** Muestra en el sidebar solo las vistas que el rol permite. */
  function aplicarNavegacion() {
    document.querySelectorAll('.nav-btn[data-nav]').forEach(function (b) {
      if (vistaPermitida(b.dataset.nav)) {
        b.removeAttribute('hidden');
        b.style.display = '';
      } else {
        b.setAttribute('hidden', '');
        b.style.display = 'none';
      }
    });
  }

  /**
   * El Agente es de solo lectura sobre el catálogo: puede consultar posadas
   * para cotizar, pero no crearlas, editarlas, duplicarlas ni importarlas.
   */
  function aplicarPermisosEscritura() {
    var puedeEditar = Auth.puede('template:update');
    var puedeCrear = Auth.puede('template:create');
    var puedeImportar = Auth.puede('template:create');

    var btnNueva = $('btn-nueva');
    if (btnNueva) {
      if (puedeCrear) btnNueva.removeAttribute('hidden');
      else btnNueva.setAttribute('hidden', '');
    }

    var btnImport = $('btn-import');
    if (btnImport) {
      if (puedeImportar) btnImport.removeAttribute('hidden');
      else btnImport.setAttribute('hidden', '');
    }

    // Misma regla unificada para el módulo Catálogo (hoy oculto para todos):
    // si la vista no está permitida, sus botones quedan ocultos pero el código
    // (view-catalogo, Exporter, handlers) sigue intacto para reactivarlo luego.
    var catalogoVisible = vistaPermitida('catalogo');
    var btnExport = $('btn-export');
    if (btnExport) {
      if (catalogoVisible) btnExport.removeAttribute('hidden');
      else btnExport.setAttribute('hidden', '');
    }

    // El editor de plantilla solo se abre con permiso de edición
    if (!puedeEditar) state.readOnlyCatalogo = true;
  }

  // ---------------------------------------------------------------- PLANTILLAS
  function svgEdit() { return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.4a2 2 0 112.8 2.8L11 15l-4 1 1-4 9.6-9.4z"></path></svg>'; }
  function svgDup() { return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>'; }
  function svgDel() { return '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>'; }

  function showEditor(show) {
    // Solo roles con template:update pueden abrir el editor de plantillas
    if (show && state.readOnlyCatalogo) {
      showToast('Tu rol no puede editar las plantillas del catálogo');
      return;
    }
    var ed = $('tpl-editor');
    var ls = $('tpl-list');
    var sw = $('tpl-search-wrap');
    var btn = $('btn-nueva');
    if (!ed || !ls) return;
    if (show) {
      ed.classList.remove('hidden');
      ls.classList.add('hidden');
      if (sw) sw.classList.add('hidden');
      if (btn) btn.classList.add('hidden');
    } else {
      ed.classList.add('hidden');
      ls.classList.remove('hidden');
      if (sw) sw.classList.remove('hidden');
      if (btn) btn.classList.remove('hidden');
      $('pv-plantillas-nombre').textContent = '';
      var ref = state.catalog.length ? state.catalog[0] : TemplateModel.create({});
      renderStage('stage-plantillas', ref, sampleQuote(ref), false);
    }
  }

  function renderTemplateList() {
    var box = $('tpl-list');
    var term = ($('tpl-search') ? $('tpl-search').value.toLowerCase() : '').trim();

    var filtered = state.catalog.filter(function (t) {
      if (!term) return true;
      return t.nombrePosada.toLowerCase().indexOf(term) !== -1 || t.destino.toLowerCase().indexOf(term) !== -1;
    });

    if (!filtered.length) {
      box.innerHTML = '<div class="p-6 text-center text-slate-800 font-semibold text-sm">' +
        (term ? 'No se encontraron plantillas.'
              : (state.readOnlyCatalogo
                  ? 'No hay plantillas todavía.<br>Pide a un encargado que cree una posada.'
                  : 'No hay plantillas todavía.<br>Crea una posada con "+ Nueva".')) +
        '</div>';
      $('tpl-count').textContent = state.catalog.length + ' posadas';
      return;
    }

    // Botones de escritura visibles solo si el rol los permite
    var puedeEditar = !state.readOnlyCatalogo;
    var puedeCrear = Auth.puede('template:create');
    var puedeBorrar = Auth.puede('template:delete');

    box.innerHTML = filtered.map(function (t) {
      var img = TemplateModel.portada(t);
      var acciones =
        (puedeEditar ? '<button data-act="edit" data-id="' + esc(t.id) + '" class="p-2 rounded-lg text-holyPurple hover:bg-holyPurple/10 dark:hover:bg-holyPurple/20" title="Editar">' + svgEdit() + '</button>' : '') +
        (puedeCrear ? '<button data-act="dup" data-id="' + esc(t.id) + '" class="p-2 rounded-lg text-slate-800 dark:text-white/40 hover:bg-gray-100 dark:hover:bg-white/10" title="Duplicar">' + svgDup() + '</button>' : '') +
        (puedeBorrar ? '<button data-act="del" data-id="' + esc(t.id) + '" class="p-2 rounded-lg text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30" title="Eliminar">' + svgDel() + '</button>' : '');
      return '<div class="rounded-xl bg-white dark:bg-transparent border border-gray-100 dark:border-[#333333] shadow-sm p-3 flex gap-3 items-center hover:shadow-md transition-shadow">' +
        '<img src="' + esc(img) + '" alt="" class="w-14 h-14 rounded-lg object-cover shrink-0 bg-gray-100 dark:bg-white/10">' +
        '<div class="min-w-0 flex-1">' +
        '<p class="font-extrabold text-sm text-black dark:text-white truncate">' + esc(t.nombrePosada) + '</p>' +
        '<p class="text-[11px] font-semibold text-slate-800 dark:text-white/40 uppercase">' + esc(t.destino) + ' · ' + t.layoutFotos + ' foto(s)</p>' +
        '</div>' +
        (acciones ? '<div class="flex items-center gap-1 shrink-0">' + acciones + '</div>' : '') +
        '</div>';
    }).join('');
    $('tpl-count').textContent = state.catalog.length + (state.catalog.length === 1 ? ' posada' : ' posadas');
  }

  function renderEditor() {
    var t = state.edit;
    var box = $('tpl-editor');
    var layout = state.layout;

    var layoutBtns = TemplateModel.LAYOUTS.map(function (n) {
      return '<button data-act="layout" data-l="' + n + '" class="layout-btn px-3 py-1.5 rounded-lg text-xs font-extrabold border-2 ' +
        (n === layout ? 'bg-holyPurple border-holyPurple text-white' : 'border-gray-200 dark:border-[#333333] text-slate-800 dark:text-white/40 hover:border-holyPurple/40 dark:hover:border-holyPurple/40') + '">' + n + ' ' + (n > 1 ? 'fotos' : 'foto') + '</button>';
    }).join('');

    var slots = '';
    for (var i = 0; i < layout; i++) {
      var img = state.editImages[i];
      if (img) {
        slots += '<div class="relative rounded-xl overflow-hidden aspect-square border border-gray-200 dark:border-[#333333] bg-gray-100 dark:bg-white/5">' +
          '<img src="' + esc(img) + '" class="w-full h-full object-cover" alt="">' +
          '<button data-act="rmimg" data-i="' + i + '" class="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-600">✕</button>' +
          '</div>';
      } else {
        slots += '<div class="flex items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-white/20 aspect-square text-gray-300 dark:text-white/20 font-bold text-2xl">+</div>';
      }
    }

    box.innerHTML =
      '<div class="p-5">' +
      '<div class="flex items-center justify-between mb-4">' +
      '<h3 class="text-sm font-extrabold text-holyPurple uppercase">' + (t ? 'Editar plantilla' : 'Nueva plantilla') + '</h3>' +
      '<button data-act="cancel" class="text-[11px] font-bold text-slate-800 hover:text-black">Cancelar</button>' +
      '</div>' +
      '<div class="space-y-5">' +
      '<div class="grid grid-cols-3 gap-2">' +
      '<div class="col-span-3"><label class="block text-[10px] font-extrabold text-slate-800 dark:text-white/50 uppercase mb-1">Tipo de Plantilla</label>' +
      '<select id="ed-tipo" class="ed-live w-full rounded-lg border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#2a2a2a] dark:text-white px-2 py-2 text-xs font-bold uppercase"><option value="COMPLETO"' + (t && t.tipoTemplate === 'COMPLETO' ? ' selected' : '') + '>PAQUETE COMPLETO</option><option value="HOSPEDAJE"' + (t && t.tipoTemplate === 'HOSPEDAJE' ? ' selected' : '') + '>SOLO HOSPEDAJE</option></select></div>' +
      '<div><label class="block text-[10px] font-extrabold text-slate-800 dark:text-white/50 uppercase mb-1">Nombre de la posada</label>' +
      '<input id="ed-nombre" type="text" value="' + esc(t ? t.nombrePosada : '') + '" placeholder="POSADA CORALES" class="ed-live w-full rounded-lg border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#2a2a2a] dark:text-white px-2 py-2 text-xs font-bold uppercase"></div>' +
      '<div><label class="block text-[10px] font-extrabold text-slate-800 dark:text-white/50 uppercase mb-1">Destino</label>' +
      '<input id="ed-destino" type="text" value="' + esc(t ? t.destino : '') + '" placeholder="LOS ROQUES" class="ed-live w-full rounded-lg border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#2a2a2a] dark:text-white px-2 py-2 text-xs font-bold uppercase"></div>' +
      '</div>' +
      '<div><label class="block text-[10px] font-extrabold text-slate-800 dark:text-white/50 uppercase mb-1">Tipo de servicio</label>' +
      '<input id="ed-servicio" type="text" value="' + esc(t ? t.tipoServicioDefault : '') + '" placeholder="PENSIÓN COMPLETA CON EXCURSIÓN" class="ed-live w-full rounded-lg border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#2a2a2a] dark:text-white px-2 py-2 text-xs font-bold uppercase"></div>' +
      '<div class="grid grid-cols-2 gap-2">' +
      '<div><label class="block text-[10px] font-extrabold text-slate-800 dark:text-white/50 uppercase mb-1">Check-In</label>' +
      '<input id="ed-checkin-hora" type="time" value="' + esc(t ? t.checkInHora : '15:00') + '" class="ed-live w-full rounded-lg border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#2a2a2a] dark:text-white px-2 py-2 text-xs font-bold uppercase"></div>' +
      '<div><label class="block text-[10px] font-extrabold text-slate-800 dark:text-white/50 uppercase mb-1">Check-Out</label>' +
      '<input id="ed-checkout-hora" type="time" value="' + esc(t ? t.checkOutHora : '13:00') + '" class="ed-live w-full rounded-lg border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#2a2a2a] dark:text-white px-2 py-2 text-xs font-bold uppercase"></div>' +
      '</div>' +
      '<div><label class="block text-[10px] font-extrabold text-slate-800 dark:text-white/50 uppercase mb-1">Número de fotos</label>' +
      '<div class="flex gap-1.5">' + layoutBtns + '</div></div>' +
      '<div><label class="block text-[10px] font-extrabold text-slate-800 dark:text-white/50 uppercase mb-1">Imágenes de galería (' + state.editImages.length + '/' + layout + ')</label>' +
      '<div class="grid grid-cols-4 gap-2 mb-2">' + slots + '</div>' +
      '<button data-act="addimg" class="w-full rounded-lg border-2 border-dashed border-holyPurple/30 text-holyPurple text-xs font-extrabold py-2 hover:bg-holyPurple/5 dark:hover:bg-holyPurple/20">Subir o reemplazar imágenes</button>' +
      '<input id="img-input" type="file" accept="image/*" multiple class="hidden"></div>' +
      '<div><label class="block text-[10px] font-extrabold text-slate-800 dark:text-white/50 uppercase mb-1">Inclusiones (una por línea)</label>' +
      '<textarea id="ed-inclusiones" rows="10" class="ed-live w-full rounded-lg border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#2a2a2a] dark:text-white px-2 py-2 text-xs font-semibold">' +
      esc(t ? t.inclusiones.join('\n') : '') +
      '</textarea></div>' +
      '<div class="flex gap-2 pt-1">' +
      '<button data-act="save" class="flex-1 rounded-xl bg-holyPurple dark:bg-gradient-to-br dark:from-primary dark:to-primaryDark text-white text-sm font-extrabold py-2.5 hover:bg-holyPurpleDark transition-all shadow dark:shadow-[0_5px_15px_rgba(168,42,188,0.3)] dark:hover:shadow-[0_8px_20px_rgba(168,42,188,0.5)] dark:hover:-translate-y-0.5">Guardar plantilla</button>' +
      (t ? '<button data-act="del" data-id="' + esc(t.id) + '" class="rounded-xl border-2 border-red-200 text-red-500 px-4 text-sm font-extrabold hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-900/30 transition-all">Eliminar</button>' : '') +
      '</div></div></div>';
  }

  function valField(id, fallback) {
    var el = $(id);
    return el ? el.value : fallback; // Si existe el input, usa su valor (incluso si es vacío). Si no, fallback.
  }

  function draftTemplate() {
    var isNew = !state.edit || state.edit._isDraft;
    var t = state.edit || TemplateModel.create({ destino: '', layoutFotos: state.layout }, []);
    return {
      _isDraft: isNew,
      id: isNew ? undefined : t.id,
      tipoTemplate: valField('ed-tipo', t.tipoTemplate).trim().toUpperCase(),
      nombrePosada: valField('ed-nombre', t.nombrePosada).trim().toUpperCase(),
      destino: valField('ed-destino', t.destino).trim().toUpperCase(),
      tipoServicioDefault: valField('ed-servicio', t.tipoServicioDefault).trim().toUpperCase(),
      checkInHora: valField('ed-checkin-hora', t.checkInHora).trim(),
      checkOutHora: valField('ed-checkout-hora', t.checkOutHora).trim(),
      layoutFotos: state.layout,
      imagenesBase64: state.editImages.slice(),
      inclusiones: valField('ed-inclusiones', '') ? valField('ed-inclusiones', '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean) : t.inclusiones,
    };
  }

  function renderPlantillasPreview() {
    var t = draftTemplate();

    $('pv-plantillas-nombre').textContent = t.nombrePosada ? (t.nombrePosada + ' \u00b7 ' + t.destino) : '';
    // Usa el mismo layout que la cotización (buildPreview con datos de muestra)
    var q = sampleQuote(t);
    renderStage('stage-plantillas', t, q, false);
  }

  function sampleQuote(t) {
    var dest = t.destino || '';
    return Monext.buildQuote({
      plantillaId: t.id || 'posada',
      fechaCotizacion: '2026-09-20',
      aerolinea: '',
      fechaIda: '2026-11-08', salidaIda: '', llegadaIda: '',
      origenIda: '', destinoIda: dest,
      fechaRetorno: '2026-11-10', salidaRetorno: '', llegadaRetorno: '',
      origenRetorno: dest, destinoRetorno: '',
      checkIn: '2026-11-08', checkOut: '2026-11-10',
      adultos: 2, ninos: 0,
      tarifaPorAdulto: 605, tarifaPorNino: 0, moneda: 'USD',
    });
  }

  function savePlantilla() {
    var t = state.edit;
    var isExisting = t && t.id ? state.catalog.some(function (p) { return p.id === t.id; }) : false;
    var existingIds = state.catalog.filter(function (p) { return !t || p.id !== t.id; }).map(function (p) { return p.id; });
    var nueva = TemplateModel.create({
      id: t && t.id ? t.id : undefined,
      tipoTemplate: valField('ed-tipo', 'COMPLETO').trim(),
      nombrePosada: valField('ed-nombre', '').trim(),
      destino: valField('ed-destino', '').trim(),
      tipoServicioDefault: valField('ed-servicio', '').trim(),
      layoutFotos: state.layout,
      imagenesBase64: state.editImages,
      inclusiones: valField('ed-inclusiones', '') ? valField('ed-inclusiones', '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean) : [],
    }, existingIds);

    var r = TemplateModel.validate(nueva);
    if (!r.ok) {
      showToast(r.errors[0]);
      return;
    }
    if (!Auth.puede(isExisting ? 'template:update' : 'template:create')) {
      showToast('Tu rol no puede guardar plantillas');
      return;
    }

    var btnSave = document.querySelector('[data-act="save"]');
    if (btnSave) {
      btnSave.textContent = 'Guardando...';
      btnSave.disabled = true;
    }

    // Convert data:image back to Blob to upload via api/imagen-upload
    var token = Auth.usuario ? window.__supabaseSession.access_token : null;
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;

    var imagePromises = nueva.imagenesBase64.map(function(img, i) {
      if (img.startsWith('http')) return Promise.resolve(img);
      if (!img.startsWith('data:image')) return Promise.resolve(img);
      
      var mime = img.split(',')[0].split(':')[1].split(';')[0];
      var b64Data = img.split(',')[1];
      var bin = atob(b64Data);
      var arr = new Uint8Array(bin.length);
      for(var j=0; j<bin.length; j++) arr[j] = bin.charCodeAt(j);
      var blob = new Blob([arr], {type: mime});

      return fetch('/api/imagen-upload', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ posadaId: nueva.id, contentType: mime })
      }).then(r => r.json()).then(u => {
        return fetch(u.signedUrl, {
          method: 'PUT',
          body: blob,
          headers: { 'Content-Type': mime }
        }).then(() => u.publicUrl);
      });
    });

    Promise.all(imagePromises).then(function(urls) {
      nueva.imagenesBase64 = urls;
      if (isExisting) {
        state.catalog = state.catalog.map(function (p) { return p.id === t.id ? nueva : p; });
      } else {
        state.catalog = state.catalog.concat([nueva]);
      }
      
      if (Store.savePlantilla) {
        return Store.savePlantilla(nueva);
      } else {
        return Store.saveCatalog(state.catalog);
      }
    }).then(function () {
      resetEditor();
      renderTemplateList();
      populatePosadas();
      showToast('Plantilla guardada');
    }).catch(function(err) {
      showToast('Error al guardar: ' + err.message);
      if (btnSave) {
        btnSave.textContent = 'Guardar plantilla';
        btnSave.disabled = false;
      }
    });
  }

  function resetEditor() {
    state.edit = null;
    state.editImages = [];
    state.layout = 4;
    renderEditor();
    showEditor(false);
  }
  function deletePlantilla(id) {
    if (!Auth.puede('template:delete')) {
      showToast('No tienes permiso para eliminar plantillas');
      return;
    }
    customConfirm('¿Eliminar esta plantilla?', function (yes) {
      if (!yes) return;
      // Borrado real en la BD (borra fotos de Storage e inclusiones por CASCADE).
      // Antes solo se quitaba del array local y reaparecía al recargar.
      client.auth.getSession().then(function (res) {
        var token = res.data && res.data.session ? res.data.session.access_token : null;
        var headers = token ? { 'Authorization': 'Bearer ' + token } : {};
        return fetch('/api/plantillas-delete?id=' + encodeURIComponent(id), {
          method: 'DELETE', headers: headers
        });
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) throw new Error(body.error || ('HTTP ' + r.status));
        });
      }).then(function () {
        state.catalog = state.catalog.filter(function (p) { return p.id !== id; });
        if (state.edit && state.edit.id === id) resetEditor();
        renderTemplateList();
        populatePosadas();
        showToast('Plantilla eliminada');
      }).catch(function (err) {
        showToast('Error al eliminar: ' + err.message, 4000);
      });
    });
  }

  // ---------------------------------------------------------------- PREVIEW / STAGE
  var BASE_PG = 'pg-btn px-3 py-1 rounded-full transition-all text-black';
  var ACTIVE_PG = 'pg-btn px-3 py-1 rounded-full transition-all bg-holyPurple text-white';

  var stageProps = function () {
    var m = {};
    return function (id) { return m[id] = m[id] || { mode: 'all' }; };
  }();

  /**
   * Renderiza un stage de preview.
   * @param {string}  stageId       - ID del elemento stage en el DOM
   * @param {object}  t             - Plantilla
   * @param {object}  q             - Cotización (null en modo plantilla)
   * @param {boolean} modoPlantilla - true = buildTemplate (sin precios/boletos)
   */
  function renderStage(stageId, t, q, modoPlantilla) {
    var p = modoPlantilla ? Preview.buildTemplate(t) : Preview.buildPreview(t, q);
    var mode = stageProps(stageId).mode || 'all';
    var stage = $(stageId);
    stage.innerHTML =
      '<div class="preview-item" id="' + stageId + '-p1"' + (mode === 'page2' ? ' style="display:none"' : '') + '>' +
      '<div class="scale-box">' + p.page1 + '</div></div>' +
      '<div class="preview-item" id="' + stageId + '-p2"' + (mode === 'page1' ? ' style="display:none"' : '') + '>' +
      '<div class="scale-box">' + p.page2 + '</div></div>';
    fitStage(stageId);
  }

  function fitStage(stageId) {
    var stage = $(stageId);
    if (!stage) return;
    requestAnimationFrame(function () {
      var w = stage.clientWidth;
      // Si el stage aún está oculto (clientWidth 0), reintentar cuando pinte.
      // Antes quedaba escala 0/sucia solo en algunos equipos por timing.
      if (!w) {
        window.setTimeout(function () { fitStage(stageId); }, 120);
        return;
      }
      var s = Math.min(1, w / 794);
      if (!isFinite(s) || s <= 0) s = 1;
      stage.querySelectorAll('.scale-box').forEach(function (b) {
        b.style.setProperty('--s', s.toFixed(4));
      });
      stage.querySelectorAll('.preview-item').forEach(function (item) {
        var page = item.querySelector('.page-sheet');
        if (page && page.classList.contains('dynamic-height')) {
          item.style.height = Math.round(page.offsetHeight * s + 24) + 'px';
        } else {
          item.style.height = Math.round(1123 * s + 24) + 'px';
        }
      });
    });
  }

  // Re-ajusta la escala cuando cambian las condiciones de render de ese equipo:
  // resize, carga tardía de Montserrat (woff2) o de fotos de Supabase.
  var stageObserver = null;
  function watchStages() {
    ['stage-plantillas', 'stage-cotizacion'].forEach(fitStage);
    if (stageObserver) return;
    if (typeof ResizeObserver !== 'undefined') {
      stageObserver = new ResizeObserver(function () {
        ['stage-plantillas', 'stage-cotizacion'].forEach(fitStage);
      });
      ['stage-plantillas', 'stage-cotizacion'].forEach(function (id) {
        var el = $(id);
        if (el) stageObserver.observe(el);
      });
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        ['stage-plantillas', 'stage-cotizacion'].forEach(fitStage);
      });
    }
    document.addEventListener('load', function (e) {
      if (e.target && e.target.tagName === 'IMG') {
        ['stage-plantillas', 'stage-cotizacion'].forEach(fitStage);
      }
    }, true);
  }

  function setPageMode(stageId, m) {
    stageProps(stageId).mode = m;
    var p1 = $(stageId + '-p1');
    var p2 = $(stageId + '-p2');
    if (p1) p1.style.display = (m === 'page2') ? 'none' : 'block';
    if (p2) p2.style.display = (m === 'page1') ? 'none' : 'block';
    document.querySelectorAll('.pg-btn[data-stage="' + stageId + '"]').forEach(function (b) {
      b.className = b.dataset.m === m ? ACTIVE_PG : BASE_PG;
    });
  }

  // ---------------------------------------------------------------- COTIZACIÓN
  function cerrarDropdownPosada() {
    var list = $('q-posada-list');
    if (list) list.classList.add('hidden');
  }

  /**
   * Rellena el dropdown custom de posada con thumbnails y nombre.
   * Usa state.qtPosadaId para mantener la selección.
   */
  function populatePosadas() {
    var list = $('q-posada-items');
    var label = $('q-posada-label');
    var thumb = $('q-posada-thumb');
    if (!list) return;

    var term = ($('q-posada-search') ? $('q-posada-search').value.toLowerCase() : '').trim();
    var filtered = state.catalog.filter(function (t) {
      if (!term) return true;
      return t.nombrePosada.toLowerCase().indexOf(term) !== -1 || t.destino.toLowerCase().indexOf(term) !== -1;
    });

    if (!filtered.length) {
      list.innerHTML = '<div class="p-3 text-xs text-slate-800 font-semibold text-center">' +
        (term ? 'No se encontraron posadas' : 'Sin plantillas disponibles') + '</div>';
    } else {
      list.innerHTML = filtered.map(function (t) {
        var foto = TemplateModel.portada(t);
        var sel = state.qtPosadaId === t.id;
        return '<button type="button" data-posada="' + esc(t.id) + '" ' +
          'class="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-holyPurple/5 dark:hover:bg-holyPurple/20' +
          (sel ? ' bg-holyPurple/5 dark:bg-holyPurple/10' : '') + '">' +
          '<img src="' + esc(foto) + '" alt="" class="w-10 h-10 rounded-lg object-cover bg-gray-100 dark:bg-white/10 shrink-0 border border-gray-100 dark:border-[#333333]">' +
          '<span class="min-w-0 flex-1">' +
          '<span class="block text-xs font-extrabold text-black dark:text-white truncate">' + esc(t.nombrePosada) + '</span>' +
          '<span class="block text-[10px] font-semibold text-slate-800 dark:text-white/50 uppercase truncate">' + esc(t.destino) + '</span>' +
          '</span>' +
          (sel
            ? '<svg class="w-4 h-4 text-holyPurple shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>'
            : '') +
          '</button>';
      }).join('');
    }

    if (state.qtPosadaId) {
      var selT = state.catalog.filter(function (x) { return x.id === state.qtPosadaId; })[0];
      if (selT) {
        var foto = TemplateModel.portada(selT);
        if (thumb) { thumb.src = foto; thumb.classList.remove('hidden'); }
        if (label) {
          label.textContent = selT.nombrePosada;
          label.classList.remove('text-black', 'dark:text-gray-300');
          label.classList.add('text-black', 'dark:text-white', 'font-bold');
        }
      } else {
        state.qtPosadaId = '';
        if (thumb) thumb.classList.add('hidden');
        if (label) {
          label.textContent = 'Seleccione una posada…';
          label.classList.add('text-black', 'dark:text-gray-300');
          label.classList.remove('text-black', 'dark:text-white', 'font-bold');
        }
      }
    } else {
      if (thumb) thumb.classList.add('hidden');
      if (label) {
        label.textContent = 'Seleccione una posada…';
        label.classList.add('text-black', 'dark:text-gray-300');
        label.classList.remove('text-black', 'dark:text-white', 'font-bold');
      }
    }
  }

  function buildQuoteFromForm() {
    var get = function (id) { return $(id) ? $(id).value : ''; };
    var getU = function (id) { return get(id).toUpperCase(); };
    var t = state.qtTemplate || {};
    var isSoloHospedaje = get('q-tipo') === 'SOLO HOSPEDAJE';

    var cIn = isSoloHospedaje ? get('q-checkin') : get('q-fecha-ida');
    var cOut = isSoloHospedaje ? get('q-checkout') : get('q-fecha-ret');

    return Monext.buildQuote({
      fechaCotizacion: get('q-fecha-cot'),
      tipoPaquete: get('q-tipo'),
      plantillaId: state.qtPosadaId,
      aerolinea: getU('q-aerolinea'),

      // Nuevos campos
      pnr: getU('q-pnr'),
      equipaje: getU('q-equipaje'),
      vuelos: (state.vuelosDinamicos || []).slice(),
      inclusiones: get('q-inclusiones') ? get('q-inclusiones').split('\n').map(function (s) { return s.trim(); }).filter(Boolean) : undefined,

      // Vuelos estáticos (mantener compatibilidad)
      origenIda: getU('q-origen-ida'), destinoIda: getU('q-destino-ida'),
      fechaIda: get('q-fecha-ida'), salidaIda: get('q-salida-ida'), llegadaIda: get('q-llegada-ida'),
      origenRetorno: getU('q-origen-ret'), destinoRetorno: getU('q-destino-ret'),
      fechaRetorno: get('q-fecha-ret'), salidaRetorno: get('q-salida-ret'), llegadaRetorno: get('q-llegada-ret'),

      checkIn: cIn, checkInHora: t.checkInHora || '15:00',
      checkOut: cOut, checkOutHora: t.checkOutHora || '13:00',
      tipoHabitacion: '',
      servicio: t.tipoServicioDefault || '',
      adultos: get('q-adultos'), ninos: get('q-ninos'), infantes: get('q-infantes'),
      tarifaPorAdulto: get('q-tarifa-ad'), tarifaPorNino: get('q-tarifa-nin'),
      moneda: get('q-moneda'),
    });
  }

  function renderVuelosDinamicosUI() {
    var list = $('q-vuelos-list');
    if (!list) return;
    list.innerHTML = state.vuelosDinamicos.map(function (v, i) {
      return '<div class="rounded-xl border border-holyPurple/20 bg-white dark:bg-[#2a2a2a] dark:border-[#333333] p-3 space-y-2 relative" data-index="' + i + '">' +
        '<button data-act="del-vuelo" data-i="' + i + '" class="absolute top-2 right-2 text-red-500 hover:text-red-700 font-bold">✕</button>' +
        '<div class="grid grid-cols-3 gap-2">' +
        '  <div><label class="block text-[10px] font-bold text-slate-800 dark:text-gray-400 uppercase">Tipo</label>' +
        '  <select class="vd-tipo w-full rounded-lg border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#1e1e1e] dark:text-white px-2 py-1.5 text-xs input-track">' +
        '    <option value="IDA"' + (v.tipo === 'IDA' ? ' selected' : '') + '>IDA</option>' +
        '    <option value="DESTINO"' + (v.tipo === 'DESTINO' ? ' selected' : '') + '>DESTINO</option>' +
        '    <option value="RETORNO"' + (v.tipo === 'RETORNO' ? ' selected' : '') + '>RETORNO</option>' +
        '    <option value="CONEXIÓN"' + (v.tipo === 'CONEXIÓN' ? ' selected' : '') + '>CONEXIÓN</option>' +
        '  </select></div>' +
        '  <div><label class="block text-[10px] font-bold text-slate-800 dark:text-gray-400 uppercase">Origen</label>' +
        '  <input type="text" class="vd-origen w-full rounded-lg border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#1e1e1e] dark:text-white px-2 py-1.5 text-xs input-track uppercase" value="' + esc(v.origen) + '"></div>' +
        '  <div><label class="block text-[10px] font-bold text-slate-800 dark:text-gray-400 uppercase">Destino</label>' +
        '  <input type="text" class="vd-destino w-full rounded-lg border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#1e1e1e] dark:text-white px-2 py-1.5 text-xs input-track uppercase" value="' + esc(v.destino) + '"></div>' +
        '</div>' +
        '<div class="grid grid-cols-4 gap-2">' +
        '  <div><label class="block text-[10px] font-bold text-slate-800 dark:text-gray-400 uppercase">Fecha</label>' +
        '  <input type="date" class="vd-fecha w-full rounded-lg border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#1e1e1e] dark:text-white px-2 py-1.5 text-xs input-track" value="' + esc(v.fecha) + '"></div>' +
        '  <div><label class="block text-[10px] font-bold text-slate-800 dark:text-gray-400 uppercase">Salida</label>' +
        '  <input type="time" class="vd-salida w-full rounded-lg border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#1e1e1e] dark:text-white px-2 py-1.5 text-xs input-track" value="' + esc(v.salida) + '"></div>' +
        '  <div><label class="block text-[10px] font-bold text-slate-800 dark:text-gray-400 uppercase">Llegada</label>' +
        '  <input type="time" class="vd-llegada w-full rounded-lg border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#1e1e1e] dark:text-white px-2 py-1.5 text-xs input-track" value="' + esc(v.llegada) + '"></div>' +
        '  <div><label class="block text-[10px] font-bold text-slate-800 dark:text-gray-400 uppercase">Duración</label>' +
        '  <input type="text" placeholder="02 HRS 30 MIN" class="vd-duracion w-full rounded-lg border border-gray-200 dark:border-[#333333] bg-white dark:bg-[#1e1e1e] dark:text-white px-2 py-1.5 text-xs input-track uppercase" value="' + esc(v.duracion) + '"></div>' +
        '</div>' +
        '</div>';
    }).join('');
  }

  function calcularDuracion(salida, llegada) {
    if (!salida || !llegada) return '';
    var s = salida.split(':');
    var l = llegada.split(':');
    if (s.length !== 2 || l.length !== 2) return '';
    var sMin = parseInt(s[0], 10) * 60 + parseInt(s[1], 10);
    var lMin = parseInt(l[0], 10) * 60 + parseInt(l[1], 10);
    var diff = lMin - sMin;
    if (diff < 0) diff += 24 * 60;
    var h = Math.floor(diff / 60);
    var m = diff % 60;
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    return pad(h) + ' HRS ' + pad(m) + ' MIN';
  }

  function syncVuelosDinamicos() {
    var list = $('q-vuelos-list');
    if (!list) return;
    var rows = list.querySelectorAll('[data-index]');
    var arr = [];
    rows.forEach(function (row) {
      arr.push({
        tipo: row.querySelector('.vd-tipo').value.toUpperCase(),
        origen: row.querySelector('.vd-origen').value.toUpperCase(),
        destino: row.querySelector('.vd-destino').value.toUpperCase(),
        fecha: row.querySelector('.vd-fecha').value,
        salida: row.querySelector('.vd-salida').value,
        llegada: row.querySelector('.vd-llegada').value,
        duracion: row.querySelector('.vd-duracion').value.toUpperCase()
      });
    });
    state.vuelosDinamicos = arr;
  }

  function rebuildCotizacion() {
    var template = null;
    if (state.qtPosadaId) {
      template = state.catalog.filter(function (t) { return t.id === state.qtPosadaId; })[0] || null;
    }
    if (!template) template = TemplateModel.create({ destino: '', nombrePosada: '', layoutFotos: 1 }, []);

    // Auto-rellenar campos fijos desde la posada seleccionada ANTES de construir la cotización
    var destinoPosada = template.destino || '';
    var dIda = $('q-destino-ida');
    var oRet = $('q-origen-ret');
    var qServicio = $('q-servicio');
    var qTipo = $('q-tipo');
    var qVuelosSection = $('q-vuelos-section');

    if (dIda) dIda.value = destinoPosada;
    if (oRet) oRet.value = destinoPosada;
    if (qServicio && !qServicio.value && template.tipoServicioDefault) {
      qServicio.value = template.tipoServicioDefault;
    }

    // Lógica de visualización según Tipo de Paquete
    if (qTipo) {
      var aeroWrapper = $('q-aerolinea-wrapper');
      var estanciaSec = $('q-estancia-section');
      var vuelosDinSec = $('q-vuelos-dinamicos-section');
      var posadaSec = $('q-posada-section');

      if (qTipo.value === 'SOLO HOSPEDAJE') {
        if (qVuelosSection) qVuelosSection.classList.add('hidden');
        if (vuelosDinSec) vuelosDinSec.classList.add('hidden');
        if (aeroWrapper) aeroWrapper.classList.add('hidden');
        if (estanciaSec) estanciaSec.classList.remove('hidden');
        if (posadaSec) posadaSec.classList.remove('hidden');
      } else if (qTipo.value === 'SOLO VUELO') {
        if (qVuelosSection) qVuelosSection.classList.add('hidden');
        if (vuelosDinSec) vuelosDinSec.classList.remove('hidden');
        if (aeroWrapper) aeroWrapper.classList.remove('hidden');
        if (estanciaSec) estanciaSec.classList.add('hidden');
        if (posadaSec) posadaSec.classList.add('hidden');
      } else {
        // PAQUETE COMPLETO
        if (qVuelosSection) qVuelosSection.classList.remove('hidden');
        if (vuelosDinSec) vuelosDinSec.classList.add('hidden');
        if (aeroWrapper) aeroWrapper.classList.remove('hidden');
        if (estanciaSec) estanciaSec.classList.add('hidden');
        if (posadaSec) posadaSec.classList.remove('hidden');
      }
    }

    syncVuelosDinamicos();
    state.qtTemplate = template;
    state.qt = buildQuoteFromForm();

    $('pv-cotizacion-nombre').textContent = template.nombrePosada ? (template.nombrePosada + ' · ' + template.destino) : '';
    $('q-total-chip').querySelector('span:last-child').textContent =
      Monext.formatMoney(state.qt.tarifas.montoTotal, state.qt.tarifas.moneda);

    var nochesEl = $('q-noches');
    if (nochesEl) {
      if (state.qt.hospedaje.checkIn || state.qt.hospedaje.checkOut) {
        nochesEl.textContent = state.qt.hospedaje.dias + ' DÍAS / ' + state.qt.hospedaje.noches + ' NOCHES';
      } else {
        nochesEl.textContent = '— días / — noches';
      }
    }

    renderStage('stage-cotizacion', template, state.qt, false);
  }

  var scheduleQuote = function () {
    var timer = null;
    return function () {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () {
        rebuildCotizacion();
      }, 500);
    };
  }();

  // ---------------------------------------------------------------- CATÁLOGO
  function updateCatStats() {
    var n = state.catalog.length;
    $('cat-stats').textContent = n + (n === 1 ? ' plantilla' : ' plantillas') + ' en este equipo · exporta para compartir';
  }

  function openImportModal(nuevas, duplicadas, incoming) {
    var msg = 'Se encontraron ' + nuevas.length + ' nuevas y ' + duplicadas.length + ' duplicadas.';
    $('import-msg').textContent = msg + ' ¿Qué hago con las duplicadas?';
    $('import-modal').classList.remove('hidden');
    state.pendingImport = { nuevas: nuevas, duplicadas: duplicadas, incoming: incoming };
  }

  function aplicarImportacion(mode) {
    var pend = state.pendingImport;
    if (!pend) return;
    if (!Auth.puede('template:create')) {
      showToast('Tu rol no puede importar catálogos');
      $('import-modal').classList.add('hidden');
      state.pendingImport = null;
      return;
    }
    var excluir = (mode === 'omitir') ? pend.duplicadas.map(function (p) { return p.id; }) : [];
    state.catalog = Exporter.aplicarImport(state.catalog, pend.incoming, excluir);
    Store.saveCatalog(state.catalog).then(function () {
      $('import-modal').classList.add('hidden');
      state.pendingImport = null;
      renderTemplateList();
      populatePosadas();
      updateCatStats();
      showToast('Catálogo importado correctamente');
    });
  }



  function bindEvents() {
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        setActiveNav(b.dataset.nav);
        if (b.dataset.nav === 'plantillas' && !$('tpl-editor').classList.contains('hidden')) {
          renderPlantillasPreview();
        }
      });
    });

    document.querySelectorAll('.pg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        setPageMode(b.dataset.stage, b.dataset.m);
      });
    });

    $('btn-nueva').addEventListener('click', function () {
      state.edit = null;
      state.editImages = [];
      state.layout = 4;
      renderEditor();
      renderPlantillasPreview();
      showEditor(true);
    });

    $('tpl-list').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var t = state.catalog.filter(function (p) { return p.id === btn.dataset.id; })[0];
      if (btn.dataset.act === 'edit' && t) {
        state.edit = t;
        state.editImages = (t.imagenesBase64 || []).slice();
        state.layout = Number(t.layoutFotos) || t.imagenesBase64.length || 1;
        renderEditor();
        renderPlantillasPreview();
        showEditor(true);
      } else if (btn.dataset.act === 'dup' && t) {
        if (!Auth.puede('template:create')) {
          showToast('Tu rol no puede duplicar plantillas');
          return;
        }
        var copia = TemplateModel.create({
          nombrePosada: t.nombrePosada + ' (COPIA)',
          destino: t.destino,
          tipoServicioDefault: t.tipoServicioDefault,
          layoutFotos: t.layoutFotos,
          imagenesBase64: t.imagenesBase64,
          inclusiones: t.inclusiones,
        }, state.catalog.map(function (p) { return p.id; }));
        state.catalog = state.catalog.concat([copia]);
        Store.saveCatalog(state.catalog).then(function () {
          renderTemplateList();
          populatePosadas();
          showToast('Plantilla duplicada');
        });
      } else if (btn.dataset.act === 'del') {
        deletePlantilla(btn.dataset.id);
      }
    });

    if ($('tpl-search')) $('tpl-search').addEventListener('input', renderTemplateList);
    if ($('q-posada-search')) $('q-posada-search').addEventListener('input', populatePosadas);

    $('tpl-editor').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      if (btn.dataset.act === 'save') {
        savePlantilla();
      } else if (btn.dataset.act === 'cancel') {
        resetEditor();
      } else if (btn.dataset.act === 'addimg') {
        var imgInput = $('img-input');
        if (imgInput) imgInput.click();
      } else if (btn.dataset.act === 'layout') {
        state.edit = draftTemplate(); // Guardar lo que el usuario ha escrito antes de re-renderizar
        state.layout = Number(btn.dataset.l);
        if (state.editImages.length > state.layout) {
          state.editImages = state.editImages.slice(0, state.layout);
          showToast('Imágenes ajustadas al layout de ' + state.layout);
        }
        renderEditor();
        renderPlantillasPreview();
      } else if (btn.dataset.act === 'rmimg') {
        state.edit = draftTemplate(); // Guardar antes de re-renderizar
        state.editImages.splice(Number(btn.dataset.i), 1);
        renderEditor();
        renderPlantillasPreview();
      } else if (btn.dataset.act === 'del') {
        deletePlantilla(btn.dataset.id);
      }
    });

    $('tpl-editor').addEventListener('input', function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('ed-live')) {
        renderPlantillasPreview();
      }
    });

    $('tpl-editor').addEventListener('change', function (e) {
      if (!e.target) return;

      if (e.target.id === 'img-input') {
        state.edit = draftTemplate(); // Guardar el progreso antes de subir fotos y re-renderizar
        var files = Array.prototype.slice.call(e.target.files || []);
        var libres = Math.max(0, state.layout - state.editImages.length);
        if (!libres) { showToast('Ya tienes el máximo de fotos para este layout'); e.target.value = ''; return; }
        files = files.slice(0, libres);
        var pend = files.length;
        files.forEach(function (f) {
          ImageDB.comprimirDesdeFile(f).then(function (dataUrl) {
            state.editImages.push(dataUrl);
            pend--;
            if (pend === 0) {
              e.target.value = '';
              renderEditor();
              renderPlantillasPreview();
            }
          }).catch(function (err) {
            pend--;
            showToast(err.message);
            if (pend === 0) { e.target.value = ''; renderEditor(); }
          });
        });
        return;
      }
    });

    var posadaBtn = $('q-posada-btn');
    if (posadaBtn) {
      posadaBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var list = $('q-posada-list');
        if (list) list.classList.toggle('hidden');
      });
    }

    var posadaList = $('q-posada-list');
    if (posadaList) {
      posadaList.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-posada]');
        if (!btn) return;
        state.qtPosadaId = btn.dataset.posada;
        cerrarDropdownPosada();
        populatePosadas();

        var selectedTpl = state.catalog.filter(function (p) { return p.id === state.qtPosadaId; })[0];
        if (selectedTpl && $('q-inclusiones')) {
          $('q-inclusiones').value = (selectedTpl.inclusiones || []).join('\n');
        }

        scheduleQuote();
      });
    }

    document.addEventListener('click', function (e) {
      var wrap = $('q-posada-wrap');
      if (wrap && !wrap.contains(e.target)) {
        cerrarDropdownPosada();
      }
    });

    function updateDuracionStatic() {
      var sIda = $('q-salida-ida') ? $('q-salida-ida').value : '';
      var lIda = $('q-llegada-ida') ? $('q-llegada-ida').value : '';
      var dIdaText = $('duracion-ida-text');
      var wIda = $('wrap-duracion-ida');
      if (sIda && lIda) {
        var c = calcularDuracion(sIda, lIda);
        if (dIdaText) dIdaText.textContent = c;
        if (wIda) wIda.classList.remove('hidden');
      } else {
        if (wIda) wIda.classList.add('hidden');
      }

      var sRet = $('q-salida-ret') ? $('q-salida-ret').value : '';
      var lRet = $('q-llegada-ret') ? $('q-llegada-ret').value : '';
      var dRetText = $('duracion-ret-text');
      var wRet = $('wrap-duracion-ret');
      if (sRet && lRet) {
        var c2 = calcularDuracion(sRet, lRet);
        if (dRetText) dRetText.textContent = c2;
        if (wRet) wRet.classList.remove('hidden');
      } else {
        if (wRet) wRet.classList.add('hidden');
      }
    }

    document.querySelectorAll('.input-track').forEach(function (el) {
      el.addEventListener('input', function () {
        if (el.id === 'q-salida-ida' || el.id === 'q-llegada-ida' || el.id === 'q-salida-ret' || el.id === 'q-llegada-ret') {
          updateDuracionStatic();
        }
        scheduleQuote();
      });
      el.addEventListener('change', function () {
        if (el.id === 'q-salida-ida' || el.id === 'q-llegada-ida' || el.id === 'q-salida-ret' || el.id === 'q-llegada-ret') {
          updateDuracionStatic();
        }
        scheduleQuote();
      });
    });

    var vuelosList = $('q-vuelos-list');
    if (vuelosList) {
      function checkDuracionDin(row) {
        if (!row) return;
        var sal = row.querySelector('.vd-salida');
        var lle = row.querySelector('.vd-llegada');
        var dur = row.querySelector('.vd-duracion');
        if (sal && lle && dur && sal.value && lle.value) {
          var calc = calcularDuracion(sal.value, lle.value);
          if (calc) dur.value = calc;
        }
      }
      vuelosList.addEventListener('input', function (e) {
        if (e.target.classList.contains('vd-salida') || e.target.classList.contains('vd-llegada')) {
          checkDuracionDin(e.target.closest('[data-index]'));
        }
        if (e.target.classList.contains('input-track')) {
          syncVuelosDinamicos();
          scheduleQuote();
        }
      });
      vuelosList.addEventListener('change', function (e) {
        if (e.target.classList.contains('vd-salida') || e.target.classList.contains('vd-llegada')) {
          checkDuracionDin(e.target.closest('[data-index]'));
        }
        if (e.target.classList.contains('input-track')) {
          syncVuelosDinamicos();
          scheduleQuote();
        }
      });
      vuelosList.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-act="del-vuelo"]');
        if (btn) {
          var idx = Number(btn.dataset.i);
          state.vuelosDinamicos.splice(idx, 1);
          renderVuelosDinamicosUI();
          scheduleQuote();
        }
      });
    }

    var btnAddVuelo = $('btn-add-vuelo');
    if (btnAddVuelo) {
      btnAddVuelo.addEventListener('click', function () {
        var qtyInput = $('q-vuelo-qty');
        var qty = qtyInput ? (Number(qtyInput.value) || 1) : 1;
        for (var i = 0; i < qty; i++) {
          state.vuelosDinamicos.push({
            tipo: 'IDA', origen: '', destino: '', fecha: '', salida: '', llegada: '', duracion: ''
          });
        }
        renderVuelosDinamicosUI();
        scheduleQuote();
      });
    }

    $('btn-pdf-save').addEventListener('click', function () { PdfManager.guardarPDF(); });
    $('btn-pdf-print').addEventListener('click', function () { PdfManager.imprimir(); });

    var btnClearData = $('btn-clear-data');
    if (btnClearData) {
      btnClearData.addEventListener('click', function () {
        customConfirm('¿Estás seguro de que deseas limpiar todos los datos de la cotización?', function (yes) {
          if (!yes) return;

          document.querySelectorAll('.input-track').forEach(function (el) {
            if (el.tagName === 'SELECT') {
              el.selectedIndex = 0;
              el.dispatchEvent(new Event('change'));
            } else if (el.id === 'q-fecha-cot') {
              var hoy = new Date();
              el.value = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
            } else {
              el.value = '';
            }
          });

          state.vuelosDinamicos = [];
          if (typeof renderVuelosDinamicosUI === 'function') renderVuelosDinamicosUI();

          state.qtPosadaId = '';
          cerrarDropdownPosada();

          scheduleQuote();
          showToast('Datos limpiados correctamente', 2500);
        });
      });
    }

    $('btn-export').addEventListener('click', function () {
      var data = Exporter.buildExport(state.catalog);
      Store.descargar(data, 'catalogo_plantillas.json');
      showToast('Catálogo exportado (' + data.totalPlantillas + ' plantillas)');
    });

    $('btn-import').addEventListener('click', function () { $('file-import').click(); });
    $('file-import').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      if (!Auth.puede('template:create')) {
        showToast('Tu rol no puede importar catálogos');
        e.target.value = '';
        return;
      }
      Store.leerArchivoJSON(file).then(function (obj) {
        var v = Exporter.validateFile(obj);
        if (!v.ok) { showToast(v.errors[0]); e.target.value = ''; return; }
        var plan = Exporter.planificarImport(state.catalog, obj.plantillas);
        if (plan.reemplazables.length) {
          openImportModal(plan.nuevas, plan.reemplazables, obj.plantillas);
        } else {
          state.catalog = Exporter.aplicarImport(state.catalog, obj.plantillas, []);
          Store.saveCatalog(state.catalog).then(function () {
            renderTemplateList();
            populatePosadas();
            updateCatStats();
            showToast('Catálogo importado (' + plan.nuevas.length + ' nuevas)');
          });
        }
        e.target.value = '';
      }).catch(function (err) { showToast(err.message); e.target.value = ''; });
    });

    $('imp-reemplazar').addEventListener('click', function () { aplicarImportacion('reemplazar'); });
    $('imp-omitir').addEventListener('click', function () { aplicarImportacion('omitir'); });
    $('imp-cancelar').addEventListener('click', function () {
      $('import-modal').classList.add('hidden');
      state.pendingImport = null;
    });

    window.addEventListener('resize', function () {
      ['stage-plantillas', 'stage-cotizacion'].forEach(fitStage);
    });
    watchStages();

    var toastEl = $('toast');
    if (toastEl) toastEl.addEventListener('click', ocultarToast);

    var btnDarkMode = $('btn-dark-mode');
    if (btnDarkMode) {
      btnDarkMode.addEventListener('click', function () {
        document.documentElement.classList.toggle('dark');
        var isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('holy-dark-mode', isDark);

        var iconSun = $('icon-sun');
        var iconMoon = $('icon-moon');
        var txt = $('dark-mode-text');
        var knob = $('dark-mode-knob');

        if (isDark) {
          if (iconSun) iconSun.classList.remove('hidden');
          if (iconMoon) iconMoon.classList.add('hidden');
          if (txt) txt.textContent = 'Modo Claro';
          if (knob) knob.classList.replace('translate-x-1', 'translate-x-3');
        } else {
          if (iconSun) iconSun.classList.add('hidden');
          if (iconMoon) iconMoon.classList.remove('hidden');
          if (txt) txt.textContent = 'Modo Oscuro';
          if (knob) knob.classList.replace('translate-x-3', 'translate-x-1');
        }
      });
    }
  }

  // ---------------------------------------------------------------- INIT
  function init() {
    var savedDark = localStorage.getItem('holy-dark-mode');

    // Configurar estado visual del toggle inicial
    if (savedDark === 'true') {
      document.documentElement.classList.add('dark');
      var iconSun = $('icon-sun'), iconMoon = $('icon-moon'), txt = $('dark-mode-text'), knob = $('dark-mode-knob');
      if (iconSun) iconSun.classList.remove('hidden');
      if (iconMoon) iconMoon.classList.add('hidden');
      if (txt) txt.textContent = 'Modo Claro';
      if (knob) knob.classList.replace('translate-x-1', 'translate-x-3');
    }

    var badge = $('storage-badge');
    badge.textContent = Store.tieneElectron() ? 'Electron' : 'Offline';

    var hoy = new Date();
    var qFechaCot = $('q-fecha-cot');
    if (qFechaCot && !qFechaCot.value) {
      qFechaCot.value = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0') + '-' + String(hoy.getDate()).padStart(2, '0');
    }

    bindEvents();
    renderEditor();

    // El catálogo exige un JWT válido: esperar a que auth.js resuelva el perfil
    // antes de pedirlo, o la respuesta sería 401.
    Auth.ready().then(function (usuario) {
      if (!usuario) return; // sin sesión, el overlay de login bloquea la app

      // Mostrar la app y aplicar los permisos del rol
      var shell = $('app-shell');
      if (shell) shell.classList.remove('hidden');
      aplicarNavegacion();
      aplicarPermisosEscritura();

      return Store.loadCatalog().then(function (list) {
        state.catalog = Array.isArray(list) ? list : [];
        if (!state.catalog.length) {
          // Sin datos semilla: el catálogo lo crea un encargado o admin
          // desde "Gestión de Posadas".
          showToast('No hay posadas en el catálogo. Pide a un encargado que cree la primera.', 5000);
        }
        return null;
      });
    }).then(function () {
      if (!Auth.usuario) return;
      renderTemplateList();
      populatePosadas();
      updateCatStats();
      // setActiveNav descarta pestañas no permitidas para este rol
      var savedTab = localStorage.getItem('holy-active-tab') || 'plantillas';
      setActiveNav(savedTab);
      renderPlantillasPreview();
      scheduleQuote();
      // Segundo disparo garantizado: re-calcula la escala una vez que el DOM ha pintado
      // (necesario cuando clientWidth puede ser 0 en el primer rAF)
      window.setTimeout(function () {
        ['stage-plantillas', 'stage-cotizacion'].forEach(fitStage);
      }, 0);
    }).catch(function (err) {
      showToast('Error inicializando: ' + err.message, 4000);
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  // gestion.js avisa cuando borra una posada desde "Gestión de Posadas"
  document.addEventListener('holy:catalogo-cambiado', function () {
    Store.loadCatalog().then(function (list) {
      state.catalog = Array.isArray(list) ? list : [];
      renderTemplateList();
      populatePosadas();
      updateCatStats();
    }).catch(function (err) {
      showToast('Error actualizando el catálogo: ' + err.message, 4000);
    });
  });
})();