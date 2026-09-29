// src/js/gestion.js
// Vistas de administración dentro de index.html:
//   · Gestión de Posadas — requiere template:create
//   · Usuarios            — requiere user:read
//
// Todo se habilita en base a los permisos del usuario ya autenticado por
// auth.js. Este módulo no se ejecuta hasta que Auth.ready() resuelve.

(function () {
  'use strict';

  var client = window.SupabaseClient;
  var Auth = window.Auth;

  var archivosFotos = [];

  function $(id) { return document.getElementById(id); }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function apiHeaders(extra) {
    return client.auth.getSession().then(function (res) {
      var t = res.data && res.data.session ? res.data.session.access_token : null;
      var h = extra || {};
      if (t) h['Authorization'] = 'Bearer ' + t;
      return h;
    });
  }

  function getJSON(url) {
    return apiHeaders().then(function (headers) {
      return fetch(url, { headers: headers }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) throw new Error(body.error || ('HTTP ' + r.status));
          return body;
        });
      });
    });
  }

  function postJSON(url, payload) {
    return apiHeaders({ 'Content-Type': 'application/json' }).then(function (headers) {
      return fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(payload) });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok) throw new Error(body.error || ('HTTP ' + r.status));
        return body;
      });
    });
  }

  function delJSON(url) {
    return apiHeaders().then(function (headers) {
      return fetch(url, { method: 'DELETE', headers: headers });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok) throw new Error(body.error || ('HTTP ' + r.status));
        return body;
      });
    });
  }

  function generarUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  function hay(id) { return !!$(id); }

  // ─── GESTIÓN DE POSADAS ────────────────────────────────────────────────────

  function cargarPosadas() {
    if (!hay('tabla-posadas')) return Promise.resolve();
    var tbody = $('tabla-posadas');
    return getJSON('/api/plantillas-list').then(function (plantillas) {
      if (!plantillas.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-6 text-center text-gray-500 text-sm font-semibold">No hay posadas en el catálogo.</td></tr>';
        return;
      }
      tbody.innerHTML = plantillas.map(function (p) {
        var puedeBorrar = Auth.puede('template:delete');
        return '<tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition border-b border-gray-50 dark:border-white/5 last:border-0">' +
          '<td class="p-2 sm:p-4 font-bold text-gray-800 dark:text-gray-200">' + escapar(p.nombrePosada) + '</td>' +
          '<td class="p-2 sm:p-4 text-gray-500 dark:text-gray-400 text-sm">' + escapar(p.destino) + '</td>' +
          '<td class="p-2 sm:p-4"><span class="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-md">ACTIVA</span></td>' +
          '<td class="p-2 sm:p-4 text-right">' +
            (puedeBorrar
              ? '<button data-posada-eliminar="' + escapar(p.id) + '" class="text-xs font-bold text-red-500 hover:underline">Eliminar</button>'
              : '') +
          '</td></tr>';
      }).join('');
    }).catch(function (err) {
      tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500 text-sm">' + escapar(err.message) + '</td></tr>';
    });
  }

  function escapar(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ─── USUARIOS (vía UserService) ────────────────────────────────────────────

  var cacheUsuarios = [];

  function targetDe(u) {
    return { id: u.id, rol: u.rol, rango: (window.Roles.RANGO[u.rol] || u.rango || 0) };
  }

  function cargarUsuarios() {
    if (!hay('tabla-usuarios')) return Promise.resolve();
    var tbody = $('tabla-usuarios');
    var SVC = window.UserService;
    var loader = SVC ? SVC.list() : getJSON('/api/usuarios-list');
    return loader.then(function (usuarios) {
      cacheUsuarios = usuarios || [];
      pintarUsuarios();
    }).catch(function (err) {
      tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-red-500 text-sm">' + escapar(err.message) + '</td></tr>';
    });
  }

  function usuariosFiltrados() {
    var q = ($('usuarios-buscar') && $('usuarios-buscar').value || '').trim().toLowerCase();
    var rol = ($('usuarios-filtro-rol') && $('usuarios-filtro-rol').value) || 'todos';
    return cacheUsuarios.filter(function (u) {
      var okRol = rol === 'todos' || u.rol === rol;
      var okQ = !q || String(u.nombre || '').toLowerCase().indexOf(q) !== -1 ||
        String(u.email || '').toLowerCase().indexOf(q) !== -1;
      return okRol && okQ;
    });
  }

  function pintarUsuarios() {
    var tbody = $('tabla-usuarios');
    if (!tbody) return;
    var lista = usuariosFiltrados();
    var total = $('usuarios-total');
    if (total) total.textContent = lista.length + ' / ' + cacheUsuarios.length + ' usuarios';
    if (!lista.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-gray-500">Sin usuarios.</td></tr>';
      return;
    }
    tbody.innerHTML = lista.map(function (u) {
      var target = targetDe(u);
      var accion = '';
      if (u.activo && Auth.puede('user:deactivate', target)) {
        accion += '<button data-usuario-accion="desactivar" data-id="' + escapar(u.id) + '" class="text-xs font-bold text-orange-500 hover:underline mr-3">Desactivar</button>';
      } else if (!u.activo && Auth.puede('user:activate', target)) {
        accion += '<button data-usuario-accion="activar" data-id="' + escapar(u.id) + '" class="text-xs font-bold text-green-500 hover:underline mr-3">Activar</button>';
      }
      if (Auth.puede('user:update', target)) {
        accion += '<button data-usuario-accion="editar" data-id="' + escapar(u.id) + '" class="text-xs font-bold text-blue-500 hover:underline mr-3">Editar</button>';
        accion += '<button data-usuario-accion="reset" data-id="' + escapar(u.id) + '" class="text-xs font-bold text-purple-500 hover:underline mr-3">Reset pass</button>';
      }
      if (Auth.puede('user:delete', target)) {
        accion += '<button data-usuario-accion="delete" data-id="' + escapar(u.id) + '" class="text-xs font-bold text-red-500 hover:underline">Eliminar</button>';
      }
      return '<tr class="hover:bg-gray-50 dark:hover:bg-white/5 transition border-b border-gray-50 dark:border-white/5 last:border-0">' +
        '<td class="p-2 sm:p-4"><div class="font-bold text-gray-800 dark:text-gray-200">' + escapar(u.nombre) + '</div>' +
        '<div class="text-xs text-gray-500">' + escapar(u.email || '') + '</div></td>' +
        '<td class="p-2 sm:p-4"><span class="px-2 py-1 bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 text-xs font-bold uppercase rounded-md border border-gray-200 dark:border-white/10">' + escapar(u.rol) + '</span></td>' +
        '<td class="p-2 sm:p-4">' + (u.activo
          ? '<span class="text-green-600 font-bold text-xs flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-green-500"></span> Activo</span>'
          : '<span class="text-gray-400 font-bold text-xs flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-gray-300"></span> Inactivo</span>') +
        '</td>' +
        '<td class="p-2 sm:p-4 text-right">' + (accion || '<span class="text-xs text-gray-400">—</span>') + '</td>' +
      '</tr>';
    }).join('');
  }

  // ─── Acciones sobre usuarios ───────────────────────────────────────────────

  function accionUsuario(id, accion) {
    var SVC = window.UserService;
    var u = null;
    for (var i = 0; i < cacheUsuarios.length; i++) {
      if (cacheUsuarios[i].id === id) { u = cacheUsuarios[i]; break; }
    }
    var nombre = u ? (u.nombre + ' (' + (u.email || '') + ')') : id;

    if (accion === 'editar') { abrirModalEditar(u); return; }
    if (accion === 'reset') { abrirModalReset(u); return; }

    var verbos = { activar: 'activar', desactivar: 'desactivar', delete: 'eliminar' };
    if (!confirm('¿Seguro que deseas ' + verbos[accion] + ' a ' + nombre + '?')) return;

    var p;
    if (accion === 'delete') {
      p = SVC ? SVC.remove(id) : delJSON('/api/usuarios-delete?id=' + encodeURIComponent(id));
    } else if (accion === 'activar') {
      p = SVC ? SVC.activar(id) : postJSON('/api/usuarios-activar', { id: id });
    } else {
      p = SVC ? SVC.desactivar(id) : postJSON('/api/usuarios-desactivar', { id: id });
    }

    p.then(function () {
      if (window.showToast) window.showToast('Usuario actualizado', 2500);
      return cargarUsuarios();
    }).catch(function (err) { alert('Error: ' + err.message); });
  }

  function abrirModalReset(u) {
    if (!u) return;
    var nuevo = prompt('Nueva contraseña para ' + u.nombre + ' (' + (u.email || '') + ') — mínimo 8 caracteres:');
    if (nuevo === null) return;
    if (nuevo.length < 8) { alert('La contraseña debe tener al menos 8 caracteres'); return; }
    window.UserService.resetPassword(u.id, nuevo).then(function () {
      if (window.showToast) window.showToast('Contraseña restablecida. Ya puede entrar con la nueva.', 3500);
      else alert('Contraseña restablecida.');
    }).catch(function (err) { alert('Error: ' + err.message); });
  }

  function abrirModalEditar(u) {
    if (!u) return;
    var m = $('modal-usuario-editar');
    if (!m) { alert('Modal de edición no disponible'); return; }
    $('usuario-edit-id').value = u.id;
    $('usuario-edit-nombre').value = u.nombre || '';
    $('usuario-edit-rol').value = u.rol || 'agente';
    $('usuario-edit-error').classList.add('hidden');
    m.classList.remove('hidden');
  }

  // ─── Modal de posada ───────────────────────────────────────────────────────

  function bindPosada() {
    var btnNueva = $('btn-nueva-posada');
    if (btnNueva) {
      btnNueva.addEventListener('click', function () {
        $('form-posada').reset();
        archivosFotos = [];
        renderPreviews();
        $('modal-posada').classList.remove('hidden');
      });
    }

    $('cerrar-modal-posada').addEventListener('click', function () { $('modal-posada').classList.add('hidden'); });
    $('cancelar-posada').addEventListener('click', function () { $('modal-posada').classList.add('hidden'); });

    // Drag & drop de fotos
    var dropZone = $('drop-zone');
    var fileInput = $('file-input');

    dropZone.addEventListener('click', function () { fileInput.click(); });
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(function (ev) {
      dropZone.addEventListener(ev, function (e) { e.preventDefault(); e.stopPropagation(); }, false);
    });
    dropZone.addEventListener('drop', function (e) { manejarArchivos(e.dataTransfer.files); });
    fileInput.addEventListener('change', function (e) { manejarArchivos(e.target.files); });

    $('form-posada').addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('guardar-posada-btn');
      btn.textContent = 'Guardando...';
      btn.disabled = true;

      apiHeaders({ 'Content-Type': 'application/json' }).then(function (headers) {
        var posadaId = generarUUID();
        var imagenes = [];

        // 1. Subir fotos al Storage y recolectar URLs
        return archivosFotos.reduce(function (chain, file) {
          return chain.then(function () {
            return fetch('/api/imagen-upload', {
              method: 'POST', headers: headers,
              body: JSON.stringify({ posadaId: posadaId, contentType: file.type })
            }).then(function (r) { return r.json(); }).then(function (u) {
              return fetch(u.signedUrl, {
                method: 'PUT', body: file, headers: { 'Content-Type': file.type }
              }).then(function () { imagenes.push(u.publicUrl); });
            });
          });
        }, Promise.resolve()).then(function () {
          // 2. Guardar la posada
          return fetch('/api/plantillas-save', {
            method: 'POST', headers: headers,
            body: JSON.stringify({
              id: posadaId,
              nombrePosada: $('posada-nombre').value,
              destino: $('posada-destino').value,
              inclusiones: $('posada-inclusiones').value.split('\n').filter(function (l) { return l.trim(); }),
              imagenesBase64: imagenes
            })
          });
        });
      }).then(function (r) {
        if (!r.ok) {
          return r.json().catch(function () { return {}; }).then(function (b) {
            throw new Error(b.error || 'No se pudo guardar la posada');
          });
        }
        $('modal-posada').classList.add('hidden');
        return cargarPosadas();
      }).then(function () {
        if (window.showToast) window.showToast('Posada guardada con éxito', 3000);
      }).catch(function (err) {
        alert('Error guardando: ' + err.message);
      }).then(function () {
        btn.textContent = 'Guardar Posada';
        btn.disabled = false;
      });
    });
  }

  function manejarArchivos(files) {
    var validos = Array.prototype.filter.call(files, function (f) { return f.type.indexOf('image/') === 0; });
    archivosFotos = archivosFotos.concat(validos);
    renderPreviews();
  }

  function renderPreviews() {
    var cont = $('preview-fotos');
    cont.innerHTML = archivosFotos.map(function (file, i) {
      var url = URL.createObjectURL(file);
      return '<div class="relative group rounded-xl overflow-hidden aspect-video border border-gray-200">' +
        '<img src="' + url + '" class="w-full h-full object-cover">' +
        '<div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">' +
        '<button type="button" data-quitar-foto="' + i + '" class="text-white bg-red-500 rounded-full p-2 hover:bg-red-600 transition">' +
        '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>' +
        '</button></div></div>';
    }).join('');

    Array.prototype.forEach.call(cont.querySelectorAll('[data-quitar-foto]'), function (b) {
      b.addEventListener('click', function () {
        archivosFotos.splice(Number(b.dataset.quitarFoto), 1);
        renderPreviews();
      });
    });
  }

  // ─── Modal de usuario ──────────────────────────────────────────────────────

  function bindUsuario() {
    var btnNuevo = $('btn-nuevo-usuario');
    if (btnNuevo) {
      btnNuevo.addEventListener('click', function () {
        $('form-usuario').reset();
        $('usuario-error').classList.add('hidden');
        $('modal-usuario').classList.remove('hidden');
      });
    }

    var cerrar = $('cerrar-modal-usuario');
    if (cerrar) cerrar.addEventListener('click', function () { $('modal-usuario').classList.add('hidden'); });

    var toggle = $('usuario-pass-toggle');
    if (toggle) toggle.addEventListener('click', function () {
      var inp = $('usuario-pass');
      inp.type = inp.type === 'password' ? 'text' : 'password';
      toggle.textContent = inp.type === 'password' ? 'Ver' : 'Ocultar';
    });

    var form = $('form-usuario');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('guardar-usuario-btn');
      var err = $('usuario-error');
      btn.textContent = 'Guardando...';
      btn.disabled = true;
      err.classList.add('hidden');

      var datos = {
        nombre: $('usuario-nombre').value,
        email: $('usuario-email').value,
        pass: $('usuario-pass').value,
        rol: $('usuario-rol').value
      };
      var SVC = window.UserService;
      var p = SVC ? SVC.create(datos) : postJSON('/api/usuarios-save', datos);
      p.then(function (res) {
        $('modal-usuario').classList.add('hidden');
        var msg = 'Usuario ' + (res.email || datos.email) + ' listo: ya puede iniciar sesión.';
        if (window.showToast) window.showToast(msg, 4000);
        return cargarUsuarios();
      }).catch(function (error) {
        var msg = error.message;
        if (error.status === 409) msg = 'Ese email ya está registrado';
        err.textContent = msg;
        err.classList.remove('hidden');
      }).then(function () {
        btn.textContent = 'Crear Usuario';
        btn.disabled = false;
      });
    });

    // Filtros en memoria
    var b = $('usuarios-buscar');
    if (b) b.addEventListener('input', pintarUsuarios);
    var f = $('usuarios-filtro-rol');
    if (f) f.addEventListener('change', pintarUsuarios);

    // Modal editar
    var cerrarEdit = $('cerrar-modal-usuario-editar');
    if (cerrarEdit) cerrarEdit.addEventListener('click', function () { $('modal-usuario-editar').classList.add('hidden'); });
    var formEdit = $('form-usuario-editar');
    if (formEdit) formEdit.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('guardar-usuario-edit-btn');
      var err = $('usuario-edit-error');
      btn.textContent = 'Guardando...';
      btn.disabled = true;
      err.classList.add('hidden');
      window.UserService.update($('usuario-edit-id').value, {
        nombre: $('usuario-edit-nombre').value,
        rol: $('usuario-edit-rol').value
      }).then(function () {
        $('modal-usuario-editar').classList.add('hidden');
        if (window.showToast) window.showToast('Usuario actualizado', 2500);
        return cargarUsuarios();
      }).catch(function (error) {
        err.textContent = error.message;
        err.classList.remove('hidden');
      }).then(function () {
        btn.textContent = 'Guardar Cambios';
        btn.disabled = false;
      });
    });

    // Modal mi cuenta (cambio de contraseña propia)
    var btnCuenta = $('btn-mi-cuenta');
    if (btnCuenta) btnCuenta.addEventListener('click', function () {
      var m = $('modal-mi-cuenta');
      if (!m) return;
      $('mi-cuenta-error').classList.add('hidden');
      $('mi-cuenta-ok').classList.add('hidden');
      $('form-mi-cuenta').reset();
      m.classList.remove('hidden');
    });
    var cerrarCuenta = $('cerrar-modal-mi-cuenta');
    if (cerrarCuenta) cerrarCuenta.addEventListener('click', function () { $('modal-mi-cuenta').classList.add('hidden'); });
    var formCuenta = $('form-mi-cuenta');
    if (formCuenta) formCuenta.addEventListener('submit', function (e) {
      e.preventDefault();
      var err = $('mi-cuenta-error');
      var ok = $('mi-cuenta-ok');
      var btn = $('guardar-mi-cuenta-btn');
      err.classList.add('hidden'); ok.classList.add('hidden');
      var p1 = $('mi-cuenta-pass1').value;
      var p2 = $('mi-cuenta-pass2').value;
      if (p1 !== p2) { err.textContent = 'Las contraseñas no coinciden'; err.classList.remove('hidden'); return; }
      btn.textContent = 'Guardando...'; btn.disabled = true;
      Auth.cambiarMiPassword(p1).then(function () {
        ok.textContent = 'Contraseña actualizada';
        ok.classList.remove('hidden');
        formCuenta.reset();
      }).catch(function (error) {
        err.textContent = error.message;
        err.classList.remove('hidden');
      }).then(function () {
        btn.textContent = 'Actualizar Contraseña'; btn.disabled = false;
      });
    });
  }

  // ─── Delegación de eventos en las tablas ──────────────────────────────────

  function bindTablas() {
    var tp = $('tabla-posadas');
    if (tp) {
      tp.addEventListener('click', function (e) {
        var b = e.target.closest('[data-posada-eliminar]');
        if (!b) return;
        var id = b.dataset.posadaEliminar;
        if (!confirm('¿Eliminar esta posada? Se borrarán sus fotos e inclusiones.')) return;
        delJSON('/api/plantillas-delete?id=' + encodeURIComponent(id))
          .then(function () {
            cargarPosadas();
            // app.js escucha este evento y recarga el catálogo en memoria
            document.dispatchEvent(new CustomEvent('holy:catalogo-cambiado'));
          })
          .catch(function (err) { alert('Error: ' + err.message); });
      });
    }

    var tu = $('tabla-usuarios');
    if (tu) {
      tu.addEventListener('click', function (e) {
        var b = e.target.closest('[data-usuario-accion]');
        if (!b) return;
        accionUsuario(b.dataset.id, b.dataset.usuarioAccion);
      });
    }
  }

  // ─── INIT ──────────────────────────────────────────────────────────────────

  Auth.ready().then(function (usuario) {
    if (!usuario) return; // sin sesión, el overlay de login bloquea la app

    // Habilitar lo que el rol permite
    if (Auth.puede('template:create')) cargarPosadas();
    if (Auth.puede('user:read')) cargarUsuarios();

    bindTablas();
    // Botón Nueva Posada visible solo con permiso (misma regla que la vista).
    // El modal y su lógica quedan intactos para quien sí tiene acceso.
    var btnNuevaPosada = $('btn-nueva-posada');
    if (btnNuevaPosada) {
      if (Auth.puede('template:create')) {
        btnNuevaPosada.removeAttribute('hidden');
        btnNuevaPosada.style.display = '';
      } else {
        btnNuevaPosada.setAttribute('hidden', '');
        btnNuevaPosada.style.display = 'none';
      }
    }
    if (Auth.puede('template:create')) bindPosada();
    if (Auth.puede('user:create')) {
      bindUsuario();
      var btnNuevoUsuario = $('btn-nuevo-usuario');
      if (btnNuevoUsuario) {
        btnNuevoUsuario.removeAttribute('hidden');
        btnNuevoUsuario.style.display = '';
      }
    } else {
      var btnNuevoUsuario = $('btn-nuevo-usuario');
      if (btnNuevoUsuario) {
        btnNuevoUsuario.setAttribute('hidden', '');
        btnNuevoUsuario.style.display = 'none';
      }
    }

    // El badge del sidebar
    var badge = $('user-role-badge');
    var name = $('user-name');
    if (badge) badge.textContent = usuario.rol;
    if (name) name.textContent = usuario.nombre || usuario.rol;
    // El mismo rol se refleja en el topbar móvil
    var badgeMobile = $('user-role-badge-mobile');
    if (badgeMobile) badgeMobile.textContent = usuario.rol;
  });

})();
