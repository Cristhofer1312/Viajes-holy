// netlify/functions/_lib/db.js
// Pool de conexiones a Postgres (reemplaza a _lib/supabase.js).
//
//   const { query, tx } = require('./_lib/db');
//   const { rows } = await query('SELECT * FROM posadas WHERE id = $1', [id]);
//   await tx(async (c) => { await c.query(...); await c.query(...); });

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => console.error('[db] error en conexión inactiva:', err.message));

// numeric (montos) → number en JS, en lugar de string
require('pg').types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

function query(text, params) {
  return pool.query(text, params);
}

/** Ejecuta fn(client) dentro de una transacción (COMMIT / ROLLBACK automático). */
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, tx };
