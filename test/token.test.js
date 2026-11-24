// test/token.test.js — JWT propio y hash de contraseñas (_lib/token.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

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

test('expiración por defecto es 24 h y JWT_EXPIRES_HOURS se acota entre 1 y 168', () => {
  const prev = process.env.JWT_EXPIRES_HOURS;
  try {
    delete process.env.JWT_EXPIRES_HOURS;
    assert.equal(token.EXPIRA_HORAS, 24);
    const p24 = token.verificar(token.emitir(usuario));
    assert.equal(p24.exp - p24.iat, 24 * 3600);

    process.env.JWT_EXPIRES_HOURS = '0';
    assert.equal(token.EXPIRA_HORAS, 1);

    process.env.JWT_EXPIRES_HOURS = '-12';
    assert.equal(token.EXPIRA_HORAS, 1);

    process.env.JWT_EXPIRES_HOURS = '500';
    assert.equal(token.EXPIRA_HORAS, 168);

    process.env.JWT_EXPIRES_HOURS = '48';
    assert.equal(token.EXPIRA_HORAS, 48);
    const p48 = token.verificar(token.emitir(usuario));
    assert.equal(p48.exp - p48.iat, 48 * 3600);

    process.env.JWT_EXPIRES_HOURS = 'invalido';
    assert.equal(token.EXPIRA_HORAS, 24);
  } finally {
    if (prev === undefined) delete process.env.JWT_EXPIRES_HOURS;
    else process.env.JWT_EXPIRES_HOURS = prev;
  }
});

test('tokens antiguos válidos (168 h) siguen verificando hasta expirar', () => {
  const prev = process.env.JWT_EXPIRES_HOURS;
  try {
    process.env.JWT_EXPIRES_HOURS = '168';
    const tokenViejo = token.emitir(usuario);
    delete process.env.JWT_EXPIRES_HOURS;
    const p = token.verificar(tokenViejo);
    assert.equal(p.sub, usuario.id);
    assert.equal(p.exp - p.iat, 168 * 3600);
  } finally {
    if (prev === undefined) delete process.env.JWT_EXPIRES_HOURS;
    else process.env.JWT_EXPIRES_HOURS = prev;
  }
});

test('bcrypt usa coste 12 por defecto y sigue verificando hashes previos de coste 10', async () => {
  assert.equal(token.BCRYPT_COST, 12);
  const hash12 = await token.hashPassword('claveSegura12');
  assert.match(hash12, /^\$2[aby]\$12\$/);
  assert.equal(await token.compararPassword('claveSegura12', hash12), true);

  const hash10 = bcrypt.hashSync('claveVieja10', 10);
  assert.match(hash10, /^\$2[aby]\$10\$/);
  assert.equal(await token.compararPassword('claveVieja10', hash10), true);
  assert.equal(await token.compararPassword('otraClave', hash10), false);
});

test('rechaza contraseñas de más de 72 bytes UTF-8 antes de bcrypt', async () => {
  const pass72 = 'a'.repeat(72);
  const hash72 = bcrypt.hashSync(pass72, 4);
  assert.equal(await token.compararPassword(pass72, hash72), true);
  // Sin la guarda, bcrypt truncaría el byte 73 y devolvería true
  assert.equal(await token.compararPassword(pass72 + 'x', hash72), false);

  await assert.rejects(() => token.hashPassword('a'.repeat(73)), /72 bytes/);
  // 37 caracteres 'ñ' = 74 bytes UTF-8 (aunque .length sea 37)
  await assert.rejects(() => token.hashPassword('ñ'.repeat(37)), /72 bytes/);
  assert.equal(await token.compararPassword('ñ'.repeat(37), hash72), false);
});
