// test/auth-security.test.js — Seguridad de login, rate limiting, CORS y verificarAuth
const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

process.env.JWT_SECRET = 's'.repeat(40);

// Mock liviano de _lib/db.js antes de cargar _lib/auth.js y auth-login.js
const dbPath = require.resolve('../netlify/functions/_lib/db.js');
let mockQuery = async () => ({ rows: [] });
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: {
    query: (...args) => mockQuery(...args),
    tx: async (fn) => fn({ query: (...args) => mockQuery(...args) }),
  },
};

const token = require('../netlify/functions/_lib/token.js');
const auth = require('../netlify/functions/_lib/auth.js');
const login = require('../netlify/functions/auth-login.js');

const HASH_RAPIDO = bcrypt.hashSync('PasswordCorrecta1', 4);
const HASH_COSTE_10 = bcrypt.hashSync('PasswordCorrecta1', 10);

function postLogin(body, headers = {}) {
  return login.handler({
    httpMethod: 'POST',
    headers,
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('CORS: sin CORS_ORIGIN no envía Access-Control-Allow-Origin ni *', () => {
  const prev = process.env.CORS_ORIGIN;
  try {
    delete process.env.CORS_ORIGIN;
    assert.equal(auth.CORS_HEADERS['Access-Control-Allow-Origin'], undefined);

    const h = auth.corsHeaders({ headers: { origin: 'https://ejemplo.com' } });
    assert.equal(h['Access-Control-Allow-Origin'], undefined);
    assert.equal(h['Vary'], undefined);
    assert.ok(!Object.values(h).includes('*'));

    const opt = auth.handleOptions({ headers: { origin: 'https://ejemplo.com' } });
    assert.equal(opt.headers['Access-Control-Allow-Origin'], undefined);

    process.env.CORS_ORIGIN = '*';
    const hStar = auth.corsHeaders({ headers: { origin: 'https://ejemplo.com' } });
    assert.equal(hStar['Access-Control-Allow-Origin'], undefined);
  } finally {
    if (prev === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = prev;
  }
});

test('CORS: con lista CORS_ORIGIN refleja solo orígenes permitidos y añade Vary: Origin', () => {
  const prev = process.env.CORS_ORIGIN;
  try {
    process.env.CORS_ORIGIN = 'https://app.holy.com, https://admin.holy.com';

    const ok1 = auth.ok({ a: 1 }, 200, { headers: { origin: 'https://app.holy.com' } });
    assert.equal(ok1.headers['Access-Control-Allow-Origin'], 'https://app.holy.com');
    assert.equal(ok1.headers['Vary'], 'Origin');

    const ok2 = auth.handleOptions({ headers: { Origin: 'https://admin.holy.com' } });
    assert.equal(ok2.headers['Access-Control-Allow-Origin'], 'https://admin.holy.com');
    assert.equal(ok2.headers['Vary'], 'Origin');

    const evil = auth.error('no', 401, { headers: { origin: 'https://evil.com' } });
    assert.equal(evil.headers['Access-Control-Allow-Origin'], undefined);
    assert.equal(evil.headers['Vary'], 'Origin');

    const sinOrigin = auth.ok({ a: 1 }, 200, { headers: {} });
    assert.equal(sinOrigin.headers['Access-Control-Allow-Origin'], undefined);
    assert.equal(sinOrigin.headers['Vary'], 'Origin');

    // A través de conEvento (como hace server.js)
    const viaCtx = auth.conEvento({ headers: { origin: 'https://app.holy.com' } }, () => auth.ok({ ok: true }));
    assert.equal(viaCtx.headers['Access-Control-Allow-Origin'], 'https://app.holy.com');
    assert.equal(viaCtx.headers['Vary'], 'Origin');
  } finally {
    if (prev === undefined) delete process.env.CORS_ORIGIN;
    else process.env.CORS_ORIGIN = prev;
  }
});

test('verificarAuth exige formato estricto /^Bearer\\s+(\\S+)$/i', async () => {
  const validJwt = token.emitir({ id: 'u-1', sesion_version: 1 });
  mockQuery = async () => ({
    rows: [{
      id: 'u-1',
      email: 'agente@holy.com',
      nombre: 'Agente',
      rol: 'agente',
      activo: true,
      sesion_version: 1,
      creado_at: '2026-01-01',
      creado_por: null,
    }],
  });

  const invalidos = [
    undefined,
    '',
    validJwt,
    `Basic ${validJwt}`,
    'Bearer',
    'Bearer ',
    `Bearer ${validJwt} extra`,
    ` Bearer ${validJwt}`,
    `Bearer ${validJwt} `,
  ];

  for (const headerVal of invalidos) {
    const headers = headerVal === undefined ? {} : { authorization: headerVal };
    await assert.rejects(
      () => auth.verificarAuth({ headers }),
      (err) => err.status === 401 && auth.esAuthError(err.message)
    );
  }

  const u1 = await auth.verificarAuth({ headers: { authorization: `Bearer ${validJwt}` } });
  assert.equal(u1.id, 'u-1');

  const u2 = await auth.verificarAuth({ headers: { Authorization: `bearer   ${validJwt}` } });
  assert.equal(u2.id, 'u-1');
});

test('clave(): prioriza x-real-ip, fallback al último x-forwarded-for, luego local', () => {
  const { clave } = login._interno;
  assert.equal(
    clave({ headers: { 'x-real-ip': '203.0.113.5', 'x-forwarded-for': '1.1.1.1, 2.2.2.2' } }, ' Ana@Holy.COM '),
    '203.0.113.5|ana@holy.com'
  );
  assert.equal(
    clave({ headers: { 'x-forwarded-for': '1.1.1.1, 198.51.100.9' } }, 'a@b.com'),
    '198.51.100.9|a@b.com'
  );
  assert.equal(
    clave({ headers: {} }, 'a@b.com'),
    'local|a@b.com'
  );
});

test('spoofear X-Forwarded-For no evita el bloqueo cuando x-real-ip es el mismo', async () => {
  mockQuery = async () => ({
    rows: [{
      id: 'u-spoof',
      email: 'spoof@holy.com',
      nombre: 'Spoof',
      rol: 'agente',
      activo: true,
      sesion_version: 1,
      password_hash: HASH_RAPIDO,
    }],
  });

  for (let i = 0; i < login._interno.MAX_INTENTOS; i++) {
    const r = await postLogin(
      { email: 'spoof@holy.com', pass: 'incorrecta' },
      { 'x-real-ip': '198.51.100.10', 'x-forwarded-for': `10.0.0.${i + 1}` }
    );
    assert.equal(r.statusCode, 401);
  }

  const bloqueado = await postLogin(
    { email: 'spoof@holy.com', pass: 'PasswordCorrecta1' },
    { 'x-real-ip': '198.51.100.10', 'x-forwarded-for': '10.99.99.99' }
  );
  assert.equal(bloqueado.statusCode, 429);
});

test('rate limit independiente por email normalizado frena ataques desde distintas IPs', async () => {
  mockQuery = async () => ({
    rows: [{
      id: 'u-dist',
      email: 'distribuido@holy.com',
      nombre: 'Dist',
      rol: 'agente',
      activo: true,
      sesion_version: 1,
      password_hash: HASH_RAPIDO,
    }],
  });

  for (let i = 0; i < login._interno.MAX_INTENTOS_EMAIL; i++) {
    const emailVariante = i % 2 === 0 ? '  Distribuido@Holy.COM ' : 'distribuido@holy.com';
    const r = await postLogin(
      { email: emailVariante, pass: 'incorrecta' },
      { 'x-real-ip': `198.51.101.${i + 1}` }
    );
    assert.equal(r.statusCode, 401);
  }

  const bloqueado = await postLogin(
    { email: 'DISTRIBUIDO@holy.com', pass: 'PasswordCorrecta1' },
    { 'x-real-ip': '198.51.101.250' }
  );
  assert.equal(bloqueado.statusCode, 429);
});

test('rate limit independiente por IP frena ataques a múltiples emails', async () => {
  mockQuery = async (_, [email]) => ({
    rows: [{
      id: 'u-spray',
      email,
      nombre: 'Spray',
      rol: 'agente',
      activo: true,
      sesion_version: 1,
      password_hash: HASH_RAPIDO,
    }],
  });

  for (let i = 0; i < login._interno.MAX_INTENTOS_IP; i++) {
    const r = await postLogin(
      { email: `victima${i}@holy.com`, pass: 'incorrecta' },
      { 'x-real-ip': '198.51.102.50' }
    );
    assert.equal(r.statusCode, 401);
  }

  const bloqueado = await postLogin(
    { email: 'victima-nueva@holy.com', pass: 'PasswordCorrecta1' },
    { 'x-real-ip': '198.51.102.50' }
  );
  assert.equal(bloqueado.statusCode, 429);
});

test('poda del Map elimina primero expiradas y luego las más antiguas, nunca clear()', () => {
  const { registrarFalloEn, VENTANA_MS } = login._interno;
  const ahora = 1_000_000_000;
  const mapa = new Map();

  // Dos entradas expiradas y tres activas
  mapa.set('exp1', { n: 5, desde: ahora - VENTANA_MS - 5000 });
  mapa.set('exp2', { n: 5, desde: ahora - VENTANA_MS - 1000 });
  mapa.set('act1', { n: 3, desde: ahora - 300 });
  mapa.set('act2', { n: 4, desde: ahora - 200 });
  mapa.set('act3', { n: 2, desde: ahora - 100 });

  // Al superar maxEntradas=4, borra las expiradas y conserva todas las activas
  registrarFalloEn(mapa, 'act4', ahora, 4);
  assert.equal(mapa.size, 4);
  assert.equal(mapa.has('exp1'), false);
  assert.equal(mapa.has('exp2'), false);
  assert.equal(mapa.has('act1'), true);
  assert.equal(mapa.has('act4'), true);

  // Si sigue lleno solo con activas, elimina únicamente las más antiguas
  registrarFalloEn(mapa, 'act5', ahora + 10, 4);
  assert.equal(mapa.size, 4);
  assert.equal(mapa.has('act1'), false);
  assert.equal(mapa.has('act2'), true);
  assert.equal(mapa.has('act5'), true);
});

test('rechaza cuerpos grandes (413) y contraseñas > 72 bytes UTF-8 antes de BD/bcrypt', async () => {
  let dbCalls = 0;
  mockQuery = async () => { dbCalls++; return { rows: [] }; };

  const grande = await postLogin(
    JSON.stringify({ email: 'largo@holy.com', pass: 'x', basura: 'z'.repeat(5000) }),
    { 'x-real-ip': '198.51.103.1' }
  );
  assert.equal(grande.statusCode, 413);
  assert.equal(dbCalls, 0);

  const pass73 = await postLogin(
    { email: 'largo@holy.com', pass: 'a'.repeat(73) },
    { 'x-real-ip': '198.51.103.2' }
  );
  assert.equal(pass73.statusCode, 401);
  assert.equal(dbCalls, 0);

  const passUtf8 = await postLogin(
    { email: 'largo@holy.com', pass: 'é'.repeat(37) },
    { 'x-real-ip': '198.51.103.3' }
  );
  assert.equal(passUtf8.statusCode, 401);
  assert.equal(dbCalls, 0);
});

test('cuenta inactiva devuelve el mismo 401 genérico que contraseña incorrecta; cuenta activa con hash coste 10 funciona', async () => {
  mockQuery = async (_, [email]) => {
    if (email === 'inactivo@holy.com') {
      return {
        rows: [{
          id: 'u-inactivo',
          email: 'inactivo@holy.com',
          nombre: 'Inactivo',
          rol: 'agente',
          activo: false,
          sesion_version: 1,
          password_hash: HASH_COSTE_10,
        }],
      };
    }
    if (email === 'activo@holy.com') {
      return {
        rows: [{
          id: 'u-activo',
          email: 'activo@holy.com',
          nombre: 'Activo',
          rol: 'agente',
          activo: true,
          sesion_version: 2,
          password_hash: HASH_COSTE_10,
        }],
      };
    }
    return { rows: [] };
  };

  const rInactivo = await postLogin(
    { email: 'inactivo@holy.com', pass: 'PasswordCorrecta1' },
    { 'x-real-ip': '198.51.104.1' }
  );
  const rMalPass = await postLogin(
    { email: 'activo@holy.com', pass: 'ClaveEquivocada' },
    { 'x-real-ip': '198.51.104.2' }
  );
  assert.equal(rInactivo.statusCode, 401);
  assert.equal(rMalPass.statusCode, 401);
  assert.deepEqual(JSON.parse(rInactivo.body), { error: 'Credenciales inválidas' });
  assert.deepEqual(JSON.parse(rInactivo.body), JSON.parse(rMalPass.body));

  const rOk = await postLogin(
    { email: 'activo@holy.com', pass: 'PasswordCorrecta1' },
    { 'x-real-ip': '198.51.104.3' }
  );
  assert.equal(rOk.statusCode, 200);
  const data = JSON.parse(rOk.body);
  assert.ok(data.token);
  assert.equal(data.usuario.email, 'activo@holy.com');
  assert.equal(token.verificar(data.token).sub, 'u-activo');
});
