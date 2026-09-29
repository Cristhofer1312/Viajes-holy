// test/roles.test.js
// Cobertura de la fuente única de permisos: src/js/roles.js
// Ejecutar con: node --test test/

const test = require('node:test');
const assert = require('node:assert');
const Roles = require('../src/js/roles.js');

const { puede, RANGO } = Roles;

// Actores de prueba
const admin      = { id: 'a1', rol: 'admin',     rango: 3, activo: true };
const encargado  = { id: 'e1', rol: 'encargado', rango: 2, activo: true };
const agente     = { id: 'g1', rol: 'agente',    rango: 1, activo: true };
const inactivo   = { id: 'i1', rol: 'admin',     rango: 3, activo: false };
const desconocido = { id: 'x1', rol: 'visitante', activo: true };

// Objetivos de prueba
const otroAgente    = { id: 'g2', rol: 'agente' };
const otroEncargado = { id: 'e2', rol: 'encargado' };
const otroAdmin     = { id: 'a2', rol: 'admin' };

// ─── Guardas globales ────────────────────────────────────────────────────────

test('un usuario inactivo no puede hacer nada, ni aunque sea admin', () => {
  for (const accion of Object.keys(Roles.REGLAS)) {
    assert.strictEqual(puede(inactivo, accion, { rol: 'agente' }), false,
      `${accion} debería estar bloqueado para un inactivo`);
  }
});

test('sin actor o con rol desconocido no hay permisos', () => {
  assert.strictEqual(puede(null, 'catalog:read'), false);
  assert.strictEqual(puede({}, 'catalog:read'), false);
  assert.strictEqual(puede(desconocido, 'catalog:read'), false);
});

test('una acción inexistente nunca se permite', () => {
  assert.strictEqual(puede(admin, 'usuario:dominar-el-mundo'), false);
});

// ─── Los tres roles ven el catálogo y cotizan ────────────────────────────────

test('catalog:read y quote:create están abiertos a los tres roles', () => {
  for (const actor of [admin, encargado, agente]) {
    assert.strictEqual(puede(actor, 'catalog:read'), true, `${actor.rol} debe leer el catálogo`);
    assert.strictEqual(puede(actor, 'quote:create'), true, `${actor.rol} debe cotizar`);
  }
});

// ─── Plantillas: el agente es de solo lectura ────────────────────────────────

test('el agente no puede crear, editar ni eliminar plantillas', () => {
  assert.strictEqual(puede(agente, 'template:create'), false);
  assert.strictEqual(puede(agente, 'template:update'), false);
  assert.strictEqual(puede(agente, 'template:delete'), false);
});

test('encargado crea, edita y elimina; admin hace todo', () => {
  assert.strictEqual(puede(encargado, 'template:create'), true);
  assert.strictEqual(puede(encargado, 'template:update'), true);
  assert.strictEqual(puede(encargado, 'template:delete'), true);
  assert.strictEqual(puede(admin, 'template:delete'), true);
});

// ─── Usuarios: lectura para admin y encargado ───────────────────────────────

test('user:read lo tienen admin y encargado, no el agente', () => {
  assert.strictEqual(puede(admin, 'user:read'), true);
  assert.strictEqual(puede(encargado, 'user:read'), true);
  assert.strictEqual(puede(agente, 'user:read'), false);
});

// ─── Anti-escalación: la regla `asigna` (B8a / B8b) ────────────────────────

test('user:create exige el rol objetivo en `asigna`', () => {
  // Sin objetivo solo se comprueba el permiso base
  assert.strictEqual(puede(admin, 'user:create'), true);
  assert.strictEqual(puede(encargado, 'user:create'), false);

  // Con objetivo: admin puede crear encargado y agente
  assert.strictEqual(puede(admin, 'user:create', { rol: 'encargado' }), true);
  assert.strictEqual(puede(admin, 'user:create', { rol: 'agente' }), true);

  // Pero NO puede crear otro admin (B8a)
  assert.strictEqual(puede(admin, 'user:create', { rol: 'admin' }), false);
});

test('user:update no se aplica sobre sí mismo ni promueve a admin', () => {
  // noPropio: el admin no puede editar su propio registro
  assert.strictEqual(puede(admin, 'user:update', { id: admin.id, rol: 'admin' }), false);
  assert.strictEqual(puede(admin, 'user:update', { id: otroAgente.id, rol: 'agente' }), true);

  // Anti-escalación: no promover a admin (B8b)
  assert.strictEqual(puede(admin, 'user:update', { id: otroAgente.id, rol: 'admin' }), false);
  assert.strictEqual(puede(admin, 'user:update', { id: otroAgente.id, rol: 'encargado' }), true);
});

// ─── Borrado de usuarios (B8c) ───────────────────────────────────────────────

test('user:delete es solo de admin y nunca sobre sí mismo', () => {
  assert.strictEqual(puede(encargado, 'user:delete', { id: otroAgente.id }), false);
  assert.strictEqual(puede(agente, 'user:delete', { id: otroAgente.id }), false);
  assert.strictEqual(puede(admin, 'user:delete', { id: otroAgente.id }), true);
  assert.strictEqual(puede(admin, 'user:delete', { id: admin.id }), false);
});

// ─── Activar / desactivar: jerarquía + noPropio ─────────────────────────────

test('el encargado solo activa/desactiva a rangos inferiores', () => {
  assert.strictEqual(puede(encargado, 'user:activate', otroAgente), true);
  assert.strictEqual(puede(encargado, 'user:deactivate', otroAgente), true);

  // No a su mismo nivel
  assert.strictEqual(puede(encargado, 'user:deactivate', otroEncargado), false);
  assert.strictEqual(puede(encargado, 'user:activate', otroEncargado), false);

  // No por encima
  assert.strictEqual(puede(encargado, 'user:deactivate', otroAdmin), false);

  // Ni a sí mismo
  assert.strictEqual(puede(encargado, 'user:deactivate', { id: encargado.id, rol: 'encargado' }), false);
});

test('el admin no puede desactivar ni activarse a sí mismo (evita el lockout)', () => {
  const yo = { id: admin.id, rol: 'admin' };
  assert.strictEqual(puede(admin, 'user:deactivate', yo), false);
  assert.strictEqual(puede(admin, 'user:activate', yo), false);
});

test('el admin sí puede actuar sobre otros admins', () => {
  assert.strictEqual(puede(admin, 'user:deactivate', otroAdmin), true);
  assert.strictEqual(puede(admin, 'user:activate', otroAdmin), true);
});

test('el agente no puede activar ni desactivar a nadie', () => {
  assert.strictEqual(puede(agente, 'user:activate', otroAgente), false);
  assert.strictEqual(puede(agente, 'user:deactivate', otroAgente), false);
});

// ─── Consistencia de rangos ─────────────────────────────────────────────────

test('RANGO mantiene la jerarquía admin > encargado > agente', () => {
  assert.ok(RANGO.admin > RANGO.encargado);
  assert.ok(RANGO.encargado > RANGO.agente);
  assert.strictEqual(RANGO.admin, 3);
  assert.strictEqual(RANGO.encargado, 2);
  assert.strictEqual(RANGO.agente, 1);
});

test('el rango se puede deducir del rol cuando viene en el objetivo', () => {
  // Sin RANGO[rol] pero con `rango` explícito, la jerarquía sigue funcionando
  assert.strictEqual(puede(encargado, 'user:deactivate', { id: 'z', rango: 1 }), true);
  assert.strictEqual(puede(encargado, 'user:deactivate', { id: 'z', rango: 2 }), false);
});
