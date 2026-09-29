// src/js/userService.js
// Capa única de acceso a la API de usuarios. gestion.js solo renderiza.
// Valida y normaliza en cliente; el servidor revalida (fuente de verdad).

(function (root) {
  'use strict';

  function client() { return root.SupabaseClient; }

  function apiHeaders(extra) {
    return client().auth.getSession().then(function (res) {
      var t = res.data && res.data.session ? res.data.session.access_token : null;
      var h = extra || {};
      if (t) h['Authorization'] = 'Bearer ' + t;
      return h;
    });
  }

  function request(method, url, payload) {
    return apiHeaders({ 'Content-Type': 'application/json' }).then(function (headers) {
      var opts = { method: method, headers: headers };
      if (payload !== undefined) opts.body = JSON.stringify(payload);
      return fetch(url, opts);
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        if (!r.ok) {
          var err = new Error(body.error || ('HTTP ' + r.status));
          err.status = r.status;
          throw err;
        }
        return body;
      });
    });
  }

  function normalizarEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function validarAlta(d) {
    var email = normalizarEmail(d.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email inválido';
    if (!String(d.nombre || '').trim()) return 'El nombre es obligatorio';
    if (!d.rol || ['encargado', 'agente'].indexOf(d.rol) === -1) return 'Rol inválido';
    if (typeof d.pass !== 'string' || d.pass.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    return null;
  }

  var UserService = {
    normalizarEmail: normalizarEmail,
    validarAlta: validarAlta,
    list: function () { return request('GET', '/api/usuarios-list'); },
    create: function (d) {
      var errMsg = validarAlta(d);
      if (errMsg) return Promise.reject(new Error(errMsg));
      return request('POST', '/api/usuarios-save', {
        nombre: String(d.nombre).trim(),
        email: normalizarEmail(d.email),
        pass: d.pass,
        rol: d.rol,
      });
    },
    update: function (id, updates) {
      var payload = { id: id };
      if (updates.nombre !== undefined) payload.nombre = String(updates.nombre).trim();
      if (updates.rol !== undefined) payload.rol = updates.rol;
      return request('PUT', '/api/usuarios-update', payload);
    },
    activar: function (id) { return request('POST', '/api/usuarios-activar', { id: id }); },
    desactivar: function (id) { return request('POST', '/api/usuarios-desactivar', { id: id }); },
    remove: function (id) {
      return apiHeaders().then(function (headers) {
        return fetch('/api/usuarios-delete?id=' + encodeURIComponent(id), { method: 'DELETE', headers: headers });
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) {
          if (!r.ok) {
            var err = new Error(body.error || ('HTTP ' + r.status));
            err.status = r.status;
            throw err;
          }
          return body;
        });
      });
    },
    resetPassword: function (id, newPass) {
      if (typeof newPass !== 'string' || newPass.length < 8) {
        return Promise.reject(new Error('La nueva contraseña debe tener al menos 8 caracteres'));
      }
      return request('POST', '/api/usuarios-reset-password', { id: id, newPass: newPass });
    },
  };

  root.UserService = UserService;
})(typeof self !== 'undefined' ? self : this);
