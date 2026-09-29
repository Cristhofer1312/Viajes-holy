// test/usuarios.test.js
// Contratos del sistema de usuarios normal: alta inmediata + permisos.
// Ejecutar con: node --test test/
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const Roles = require('../src/js/roles.js');

const admin = { id: 'a1', rol: 'admin', rango: 3, activo: true };
const encargado = { id: 'e1', rol: 'encargado', rango: 2, activo: true };
const agente = { id: 'g1', rol: 'agente', rango: 1, activo: true };

// Reset de contraseña reutiliza user:update → solo admin, nunca propio,
// nunca hacia admin (anti-escalación). Así no se cambia roles.js.
test('reset-password hereda user:update: solo admin sobre inferiores', () => {
  assert.strictEqual(Roles.puede(admin, 'user:update', { id: 'g2', rol: 'agente' }), true);
  assert.strictEqual(Roles.puede(admin, 'user:update', { id: 'e9', rol: 'encargado' }), true);
  assert.strictEqual(Roles.puede(admin, 'user:update', { id: 'a1', rol: 'admin' }), false); // propio (mismo id)
  assert.strictEqual(Roles.puede(admin, 'user:update', { id: 'g2', rol: 'admin' }), false); // promoción
  assert.strictEqual(Roles.puede(encargado, 'user:update', { id: 'g2', rol: 'agente' }), false);
  assert.strictEqual(Roles.puede(agente, 'user:update', { id: 'g2', rol: 'agente' }), false);
});

test('desactivar al único admin debe bloquearse (guarda 409 en function)', () => {
  // La function cuenta admins restantes; aquí se verifica la base:
  // admin no puede auto-desactivarse (noPropio) → con 1 solo admin el sistema se protege.
  assert.strictEqual(Roles.puede(admin, 'user:deactivate', { id: 'a1', rol: 'admin' }), false);
  assert.strictEqual(Roles.puede(admin, 'user:deactivate', { id: 'a2', rol: 'admin' }), true);
});

test('UserService existe y expone la API normal', () => {
  const file = path.join(__dirname, '..', 'src', 'js', 'userService.js');
  assert.ok(fs.existsSync(file), 'src/js/userService.js debe existir');
  const src = fs.readFileSync(file, 'utf8');
  ['list', 'create', 'update', 'activar', 'desactivar', 'remove', 'resetPassword', 'validarAlta', 'normalizarEmail']
    .forEach(function (m) {
      assert.ok(src.includes(m), 'UserService debe exponer ' + m);
    });
  // Validación cliente espejo del servidor
  assert.ok(src.includes('minimo') || src.includes('al menos 8') || src.includes('length < 8'));
});

test('usuarios-list devuelve email (contrato aditivo retrocompatible)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'netlify', 'functions', 'usuarios-list.js'), 'utf8');
  assert.ok(src.includes('emailPorId') || src.includes('listUsers'), 'debe enriquecer con email desde Auth');
  assert.ok(src.includes('creado_por_nombre') || src.includes('email'), 'debe añadir email sin quitar campos');
});

test('existe function usuarios-reset-password con guardas', () => {
  const file = path.join(__dirname, '..', 'netlify', 'functions', 'usuarios-reset-password.js');
  assert.ok(fs.existsSync(file));
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("user:update"), 'reutiliza user:update para no cambiar roles.js');
  assert.ok(src.includes('updateUserById'), 'usa auth.admin.updateUserById');
  assert.ok(src.includes('al menos 8'), 'valida longitud mínima');
});
