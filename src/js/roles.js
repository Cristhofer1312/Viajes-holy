// src/js/roles.js
// Sistema de permisos jerárquico — lógica pura, sin efectos secundarios
//
// FUENTE ÚNICA DE VERDAD. Este archivo se carga tal cual tanto en el
// navegador (<script src="js/roles.js">) como en las Netlify Functions
// (require('../../src/js/roles.js')). Cualquier cambio en RANGO o REGLAS
// debe hacerse aquí y en ningún otro lugar.

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.Roles = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RANGO = { admin: 3, encargado: 2, agente: 1 };

  // Campos de una regla:
  //   roles   → lista de roles, o mapa { rol: 'cualquiera' | 'inferior' }
  //   asigna  → roles que el actor puede OTORGAR (si se omite, no hay límite).
  //             Impide la escalación de privilegios: nadie crea/promueve a admin.
  //   noPropio→ el actor no puede aplicar la acción sobre sí mismo.
  var REGLAS = {
    'catalog:read':    { roles: ['admin', 'encargado', 'agente'] },
    'quote:create':    { roles: ['admin', 'encargado', 'agente'] },
    'template:create': { roles: ['admin', 'encargado'] },
    'template:update': { roles: ['admin', 'encargado'] },
    'template:delete': { roles: ['admin', 'encargado'] },
    'user:read':       { roles: ['admin', 'encargado'] },
    'user:create':     { roles: ['admin'], asigna: ['encargado', 'agente'] },
    'user:update':     { roles: ['admin'], noPropio: true, asigna: ['encargado', 'agente'] },
    'user:delete':     { roles: ['admin'], noPropio: true },
    'user:activate':   { roles: { admin: 'cualquiera', encargado: 'inferior' }, noPropio: true },
    'user:deactivate': { roles: { admin: 'cualquiera', encargado: 'inferior' }, noPropio: true },
  };

  /**
   * Evalúa si `actor` puede realizar `accion` sobre `objetivo`.
   * @param {Object} actor    - { rol, activo, rango, id }
   * @param {string} accion   - clave de REGLAS
   * @param {Object} [objetivo] - { rol, rango, id } — requerido cuando la regla
   *   define `asigna` o `noPropio`, y siempre para acciones sobre usuarios.
   * @returns {boolean}
   */
  function puede(actor, accion, objetivo) {
    if (!actor || !actor.activo) return false;
    var regla = REGLAS[accion];
    if (!regla) return false;

    var alcance = Array.isArray(regla.roles)
      ? (regla.roles.indexOf(actor.rol) !== -1 ? 'cualquiera' : null)
      : (regla.roles[actor.rol] || null);
    if (!alcance) return false;

    // No puede aplicarse sobre sí mismo
    if (regla.noPropio && objetivo && objetivo.id && actor.id && objetivo.id === actor.id) return false;

    // Solo sobre usuarios de rango estrictamente inferior
    if (alcance === 'inferior' && objetivo) {
      var rangoObjetivo = RANGO[objetivo.rol] || (objetivo.rango || 0);
      if (actor.rango <= rangoObjetivo) return false;
    }

    // No puede otorgar un rol fuera de su lista permitida (anti escalación)
    if (regla.asigna && objetivo && objetivo.rol) {
      if (regla.asigna.indexOf(objetivo.rol) === -1) return false;
    }

    return true;
  }

  return { RANGO: RANGO, REGLAS: REGLAS, puede: puede };
});
