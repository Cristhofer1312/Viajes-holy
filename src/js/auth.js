// src/js/auth.js
// Autenticación y autorización centralizadas para index.html
//
// Es la única puerta de entrada del sistema. La app no hace nada hasta que
// Auth.ready() resuelve: el overlay de login bloquea el acceso sin sesión y
// /api/plantillas-list exige un JWT válido.
//
// Expone: window.Auth = { ready, login, logout, perfilActual, usuario, puede }

(function (root) {
  'use strict';

  var Session = root.Session;
  var Roles = root.Roles;

  var usuario = null;          // { id, nombre, rol, activo, rango }
  var readyResolvers = [];
  var listo = false;

  // ─── DOM (puede no existir si auth.js se carga en otra página) ──────────────
  function $(id) { return document.getElementById(id); }

  function mostrarOverlay() {
    var o = $('login-overlay');
    if (o) o.classList.remove('hidden');
  }

  function ocultarOverlay() {
    var o = $('login-overlay');
    if (o) o.classList.add('hidden');
  }

  function mostrarError(msg) {
    var e = $('login-error');
    if (!e) return;
    e.textContent = msg;
    e.classList.remove('hidden');
  }

  function ocultarError() {
    var e = $('login-error');
    if (e) e.classList.add('hidden');
  }

  function marcarListo() {
    listo = true;
    var rs = readyResolvers;
    readyResolvers = [];
    for (var i = 0; i < rs.length; i++) rs[i](usuario);
  }

  // ─── API ───────────────────────────────────────────────────────────────────

  /**
   * Devuelve una promesa que resuelve con el perfil del usuario.
   * Si no hay sesión, resuelve con `null` (el overlay queda visible).
   * app.js la espera antes de llamar a Store.loadCatalog().
   */
  function ready() {
    if (listo) return Promise.resolve(usuario);
    return new Promise(function (resolve) { readyResolvers.push(resolve); });
  }

  /**
   * Carga el perfil del usuario autenticado desde /api/me (fuente de verdad).
   * Token vencido o revocado (401) → null: se pide login de nuevo sin alarma.
   */
  async function cargarPerfil() {
    if (!Session.token()) return null;

    var r = await fetch('/api/me', { headers: Session.headers() });
    if (r.status === 401) {
      var body = await r.json().catch(function () { return {}; });
      Session.logout();
      if (/inactivo/i.test(body.error || '')) throw new Error('Usuario inactivo');
      return null;
    }
    if (!r.ok) throw new Error('No se pudo verificar el perfil');

    var perfil = await r.json();
    perfil.rango = Roles.RANGO[perfil.rol] || 0;
    return perfil;
  }

  /**
   * Punto de entrada: verifica la sesión y, si es válida, la perfila.
   * Cualquier fallo (sin sesión, inactivo, no registrado) deja la app bloqueada.
   */
  async function restaurarSesion() {
    try {
      if (!Session.token()) {
        usuario = null;
        mostrarOverlay();
        marcarListo();
        return null;
      }

      usuario = await cargarPerfil();
      if (!usuario) {
        usuario = null;
        mostrarOverlay();
        marcarListo();
        return null;
      }

      ocultarOverlay();
      ocultarError();
      marcarListo();
      document.dispatchEvent(new CustomEvent('holy:perfil-cargado', { detail: { usuario: usuario } }));
      return usuario;
    } catch (err) {
      console.error('[auth] Error restaurando sesión:', err.message);
      usuario = null;
      // Sesión inválida, inactiva o no registrada: cerrar y bloquear
      Session.logout();
      mostrarOverlay();
      mostrarError('Acceso denegado. Contacte al administrador.');
      marcarListo();
      return null;
    }
  }

  /** Inicia sesión. Devuelve true si el usuario queda autenticado y perfilado. */
  async function login(email, pass) {
    ocultarError();
    try {
      await Session.login(email, pass);
    } catch (err) {
      if (err.status === 403) mostrarError('Usuario inactivo. Contacte al administrador.');
      else if (err.status === 429) mostrarError('Demasiados intentos. Espera unos minutos.');
      else if (err.status === 401) mostrarError('Credenciales inválidas.');
      else mostrarError('No se pudo conectar con el servidor.');
      return false;
    }
    var perfil = await restaurarSesion();
    if (!perfil) {
      // mostrarError() ya fue llamado por restaurarSesion()
      return false;
    }
    // La app quedó inerte durante la carga sin sesión: recargar para que
    // app.js y gestion.js inicialicen con el perfil ya disponible.
    window.location.reload();
    return true;
  }

  /** Cierra sesión y devuelve al overlay de login. */
  async function logout() {
    Session.logout();
    usuario = null;
    listo = false;
    window.location.reload();
  }

  /** ¿El usuario actual puede realizar esta acción? Delega en Roles.puede. */
  function puede(accion, objetivo) {
    return Roles.puede(usuario, accion, objetivo);
  }

  /** Cambia la contraseña propia (cierra las demás sesiones de este usuario). */
  async function cambiarMiPassword(newPass) {
    if (typeof newPass !== 'string' || newPass.length < 8) {
      throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
    }
    await Session.cambiarPassword(newPass);
    return true;
  }

  // No hay recuperación por correo: un administrador restablece la
  // contraseña desde Usuarios (/api/usuarios-reset-password).

  // ─── Arranque ──────────────────────────────────────────────────────────────

  /** Botón de ojo: alterna la contraseña entre visible y oculta. */
  function bindMostrarPassword() {
    var btn = $('login-pass-toggle');
    var input = $('login-pass');
    if (!btn || !input) return;
    btn.addEventListener('click', function () {
      var mostrar = input.type === 'password';
      input.type = mostrar ? 'text' : 'password';
      var etiqueta = mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña';
      btn.setAttribute('aria-label', etiqueta);
      btn.setAttribute('title', etiqueta);
      btn.setAttribute('aria-pressed', mostrar ? 'true' : 'false');
      $('login-pass-eye').classList.toggle('hidden', mostrar);
      $('login-pass-eye-off').classList.toggle('hidden', !mostrar);
      input.focus();
    });
  }

  function bindLogin() {
    var form = $('login-form');
    if (!form) return;
    bindMostrarPassword();

    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var btn = $('login-btn');
      var email = $('login-email').value;
      var pass = $('login-pass').value;

      if (btn) {
        btn.textContent = 'Cargando...';
        btn.disabled = true;
      }
      await login(email, pass);
      if (btn) {
        btn.textContent = 'Entrar al Sistema';
        btn.disabled = false;
      }
    });
  }

  function bindLogout() {
    var btn = $('logout-btn');
    if (btn) btn.addEventListener('click', logout);
  }

  // Session avisa cuando el token cambia (también desde otras pestañas)
  if (Session) Session.onChange(function (token) {
    if (!token && usuario) {
      // Se cerró la sesión (aquí o en otra pestaña): bloquear
      usuario = null;
      listo = false;
      mostrarOverlay();
      marcarListo();
    }
  });

  if (!Session) {
    console.error('[auth] Session no disponible (falta js/session.js).');
    marcarListo();
  } else {
    bindLogin();
    bindLogout();
    restaurarSesion();
  }

  root.Auth = {
    ready: ready,
    login: login,
    logout: logout,
    restaurarSesion: restaurarSesion,
    puede: puede,
    cambiarMiPassword: cambiarMiPassword,
    get usuario() { return usuario; },
  };

})(typeof self !== 'undefined' ? self : this);
