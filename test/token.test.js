// test/token.test.js — JWT propio y hash de contraseñas (_lib/token.js)
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'x'.repeat(40);
const token = require('../netlify/functions/_lib/token.js');

const usuario = { id: '11111111-1111-4111-8111-111111111111', sesion_version: 3 };

test('emite y verifica un token válido', () => {
  const t = token.emitir(usuario);
  const p = token.verificar(t);
  assert.equal(p.sub, usuario.id);
  assert.equal(p.v, 3);
  assert.ok(p.exp > p.iat);
});

test('rechaza firma alterada, payload alterado y basura', () => {
  const t = token.emitir(usuario);
  const [h, p, f] = t.split('.');
  assert.equal(token.verificar(`${h}.${p}.${f.slice(0, -2)}xx`), null);
  const otro = Buffer.from(JSON.stringify({ sub: 'otro', v: 3, iat: 1, exp: 9999999999 })).toString('base64url');
  assert.equal(token.verificar(`${h}.${otro}.${f}`), null);
  assert.equal(token.verificar('abc'), null);
  assert.equal(token.verificar(''), null);
});

test('rechaza alg distinto de HS256 (alg:none)', () => {
  const h = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const p = Buffer.from(JSON.stringify({ sub: usuario.id, v: 3, iat: 1, exp: 9999999999 })).toString('base64url');
  assert.equal(token.verificar(`${h}.${p}.`), null);
});

test('rechaza token firmado con otro secreto', () => {
  const t = token.emitir(usuario);
  process.env.JWT_SECRET = 'y'.repeat(40);
  try { assert.equal(token.verificar(t), null); }
  finally { process.env.JWT_SECRET = 'x'.repeat(40); }
});

test('bcrypt: hash propio y hash $2a$ estilo Supabase', async () => {
  const h = await token.hashPassword('secreto123');
  assert.equal(await token.compararPassword('secreto123', h), true);
  assert.equal(await token.compararPassword('otra', h), false);
  const supa = h.replace(/^\$2b\$/, '$2a$');
  assert.equal(await token.compararPassword('secreto123', supa), true);
});

test('hash vacío o inválido nunca coincide (sin lanzar)', async () => {
  assert.equal(await token.compararPassword('x', null), false);
  assert.equal(await token.compararPassword('x', '!sin-password'), false);
  assert.equal(await token.compararPassword('x', token.hashParaComparacionCiega()), false);
});
