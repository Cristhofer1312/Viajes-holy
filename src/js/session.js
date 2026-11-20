// src/js/session.js
// Sesión del navegador contra la API propia (reemplaza a supabase-client.js).
//
// Guarda el JWT emitido por /api/auth-login en localStorage y lo expone al
// resto de módulos:
//   Session.token()            → string | null
//   Session.headers(extra)     → { Authorization: 'Bearer …', ...extra }
//   Session.login(email, pass) → Promise<usuario>   (lanza Error con .status)
//   Session.logout()
//   Session.cambiarPassword(p) → Promise<true>
//   Session.onChange(fn)       → fn(token|null) cuando cambia (también en otras pestañas)

(function (root) {
  'use strict';

  var CLAVE = 'holy.session';
  var memoria = null;   // respaldo si localStorage no está disponible
  var oyentes = [];

  function leer() {
    var s = null;
    try { s = JSON.parse(root.localStorage.getItem(CLAVE) || 'null'); } catch (e) { s = memoria; }
    if (!s || !s.token) return null;
    if (s.exp && Date.now() > s.exp) { escribir(null); return null; }
    return s;
  }

  function escribir(s) {
    memoria = s;
    try {
      if (s) root.localStorage.setItem(CLAVE, JSON.stringify(s));
      else root.localStorage.removeItem(CLAVE);
    } catch (e) { /* modo privado: queda en memoria */ }
    emitir(s ? s.token : null);
  }

  function emitir(token) {
    oyentes.forEach(function (fn) { try { fn(token); } catch (e) {} });
  }

  function guardarToken(token, horas) {
    escribir({ token: token, exp: Date.now() + (Number(horas) || 168) * 3600 * 1000 });
  }

  function token() {
    var s = leer();
    return s ? s.token : null;
  }

  function headers(extra) {
    var h = {};
    if (extra) for (var k in extra) h[k] = extra[k];
    var t = token();
    if (t) h['Authorization'] = 'Bearer ' + t;
    return h;
  }

  function postJSON(url, payload, conAuth) {
    var h = conAuth ? headers({ 'Content-Type': 'application/json' }) : { 'Content-Type': 'application/json' };
    return fetch(url, { method: 'POST', headers: h, body: JSON.stringify(payload) }).then(function (r) {
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

  function login(email, pass) {
    return postJSON('/api/auth-login', {
      email: String(email || '').trim().toLowerCase(),
      pass: pass,
    }, false).then(function (res) {
      guardarToken(res.token, res.expiraEnHoras);
      return res.usuario;
    });
  }

  function logout() {
    escribir(null);
  }

  function cambiarPassword(newPass) {
    return postJSON('/api/auth-password', { newPass: newPass }, true).then(function (res) {
      // El servidor invalida los tokens anteriores y devuelve uno nuevo
      if (res.token) guardarToken(res.token, res.expiraEnHoras);
      return true;
    });
  }

  function onChange(fn) {
    if (typeof fn === 'function') oyentes.push(fn);
  }

  // Cierre/inicio de sesión en otra pestaña
  root.addEventListener && root.addEventListener('storage', function (ev) {
    if (ev.key === CLAVE) emitir(token());
  });

  root.Session = {
    token: token,
    headers: headers,
    login: login,
    logout: logout,
    cambiarPassword: cambiarPassword,
    onChange: onChange,
  };

})(typeof self !== 'undefined' ? self : this);
