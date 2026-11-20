// scripts/migrar-desde-supabase.js
// Migración ONE-TIME: copia todo desde el proyecto de Supabase al Postgres
// del VPS y descarga las fotos de Supabase Storage al disco.
//
//   docker compose exec -e SUPABASE_DB_URL='postgresql://…' app \
//     node scripts/migrar-desde-supabase.js [--forzar]
//
// SUPABASE_DB_URL: Supabase → Project → Connect → "Session pooler"
//   (postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres)
//
// Qué migra:
//   · usuarios  (perfil + email y hash bcrypt de auth.users → las contraseñas siguen valiendo)
//   · posadas, posada_inclusiones, posada_fotos (fotos re-hospedadas en /uploads/)
//   · cotizaciones
//
// Si la BD destino ya tiene datos se detiene; --forzar la vacía antes.

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { pool, tx } = require('../netlify/functions/_lib/db');
const uploads = require('../netlify/functions/_lib/uploads');

const FORZAR = process.argv.includes('--forzar');
const HASH_INUTILIZABLE = '!sin-password';   // nunca coincide: el admin debe restablecerla

function hhmm(v, porDefecto) {
  const s = String(v || '').trim();
  return /^\d{1,2}:\d{2}/.test(s) ? s.slice(0, 5).padStart(5, '0') : porDefecto;
}

async function filas(src, sql) {
  const { rows } = await src.query(sql);
  return rows.map((r) => r.r);
}

// Descarga una foto (URL de Supabase Storage o data:) y devuelve su URL /uploads/
async function rehospedarFoto(url, posadaId, i) {
  const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  let buffer, tipo, nombre;

  if (url.startsWith('data:image')) {
    tipo = (url.match(/^data:([^;]+)/) || [])[1] || 'image/jpeg';
    buffer = Buffer.from(url.split(',')[1] || '', 'base64');
  } else {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    tipo = (r.headers.get('content-type') || 'image/jpeg').split(';')[0];
    buffer = Buffer.from(await r.arrayBuffer());
    // Conservar el nombre original si viene de .../posadas-fotos/<posada>/<archivo>
    const m = url.match(/posadas-fotos\/[^/]+\/([A-Za-z0-9._-]+)$/);
    if (m) nombre = m[1];
  }
  if (!ext[tipo]) tipo = 'image/jpeg';
  if (!nombre) nombre = `migrada-${i}-${Date.now().toString(36)}.${ext[tipo]}`;

  const dir = uploads.carpetaSegura(posadaId);
  if (!dir) throw new Error(`posadaId no apto para carpeta: ${posadaId}`);
  await fs.promises.mkdir(dir, { recursive: true });
  await fs.promises.writeFile(path.join(dir, nombre), buffer);
  return `${uploads.URL_PREFIX}${path.basename(dir)}/${nombre}`;
}

async function main() {
  if (!process.env.SUPABASE_DB_URL) throw new Error('Falta SUPABASE_DB_URL');
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL');

  // Supabase exige SSL; "?sslmode=disable" en la URL lo desactiva (pruebas locales)
  const urlOrigen = process.env.SUPABASE_DB_URL;
  const src = new Client({
    connectionString: urlOrigen,
    ssl: /sslmode=disable/.test(urlOrigen) ? false : { rejectUnauthorized: false },
  });
  await src.connect();
  console.log('\n🔌 Conectado a Supabase');

  // ── 1. Leer origen (to_jsonb tolera columnas extra o tipos distintos) ─────
  const usuarios = await filas(src, `
    SELECT to_jsonb(u) || jsonb_build_object('email', a.email, 'password_hash', a.encrypted_password) AS r
      FROM public.usuarios u JOIN auth.users a ON a.id = u.id`);
  const posadas = await filas(src, 'SELECT to_jsonb(p) AS r FROM public.posadas p');
  const inclusiones = await filas(src, 'SELECT to_jsonb(i) AS r FROM public.posada_inclusiones i');
  const fotos = await filas(src, 'SELECT to_jsonb(f) AS r FROM public.posada_fotos f');
  let cotizaciones = [];
  try {
    cotizaciones = await filas(src, 'SELECT to_jsonb(c) AS r FROM public.cotizaciones c');
  } catch (e) {
    console.warn('   ⚠️  No se pudo leer cotizaciones:', e.message);
  }
  await src.end();

  console.log(`   usuarios: ${usuarios.length} · posadas: ${posadas.length} · inclusiones: ${inclusiones.length}` +
              ` · fotos: ${fotos.length} · cotizaciones: ${cotizaciones.length}`);

  // ── 2. Comprobar destino ─────────────────────────────────────────────────
  const { rows: [cuenta] } = await pool.query(
    'SELECT (SELECT count(*) FROM usuarios) + (SELECT count(*) FROM posadas) AS n');
  if (Number(cuenta.n) > 0 && !FORZAR) {
    throw new Error('La BD destino ya tiene datos. Re-ejecuta con --forzar para vaciarla y migrar de nuevo.');
  }

  // ── 3. Descargar fotos (antes de la transacción) ─────────────────────────
  console.log('\n🖼️  Descargando fotos…');
  const idsPosada = new Set(posadas.map((p) => p.id));
  const fotosOk = [];
  for (let i = 0; i < fotos.length; i++) {
    const f = fotos[i];
    if (!idsPosada.has(f.posada_id) || !f.url) continue;
    try {
      fotosOk.push({ ...f, url: await rehospedarFoto(f.url, f.posada_id, i) });
      process.stdout.write('.');
    } catch (e) {
      console.warn(`\n   ⚠️  Foto ${f.url.slice(0, 80)}… omitida: ${e.message}`);
    }
  }
  console.log(`\n   ✅ ${fotosOk.length}/${fotos.length} fotos guardadas en ${uploads.UPLOADS_DIR}`);

  // ── 4. Escribir destino en una transacción ───────────────────────────────
  const idsUsuario = new Set(usuarios.map((u) => u.id));
  await tx(async (c) => {
    if (FORZAR) {
      await c.query('TRUNCATE cotizaciones, posada_fotos, posada_inclusiones, posadas, usuarios CASCADE');
    }

    let sinPass = 0;
    for (const u of usuarios) {
      const hash = u.password_hash && String(u.password_hash).startsWith('$2') ? u.password_hash : HASH_INUTILIZABLE;
      if (hash === HASH_INUTILIZABLE) sinPass++;
      await c.query(
        `INSERT INTO usuarios (id, email, password_hash, nombre, rol, activo, creado_at)
         VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, now()))`,
        [u.id, String(u.email || `sin-email-${u.id}@invalido`).toLowerCase(), hash,
         u.nombre || u.email || 'Sin nombre', u.rol, u.activo !== false, u.creado_at || null]);
    }
    // creado_por en una segunda pasada (puede apuntar a usuarios insertados después)
    for (const u of usuarios) {
      if (u.creado_por && idsUsuario.has(u.creado_por)) {
        await c.query('UPDATE usuarios SET creado_por = $2 WHERE id = $1', [u.id, u.creado_por]);
      }
    }
    console.log(`\n👤 ${usuarios.length} usuarios` + (sinPass ? ` (${sinPass} sin contraseña: restablecer desde Usuarios)` : ''));

    for (const p of posadas) {
      await c.query(
        `INSERT INTO posadas (id, nombre, destino, tipo_servicio_default, layout_fotos,
                              checkin_hora, checkout_hora, tipo_template, activa, fecha_creacion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10::timestamptz, now()))`,
        [p.id, p.nombre || '', p.destino || '', p.tipo_servicio_default || '',
         Number(p.layout_fotos) || 1, hhmm(p.checkin_hora, '15:00'), hhmm(p.checkout_hora, '13:00'),
         p.tipo_template || 'COMPLETO', p.activa !== false, p.fecha_creacion || null]);
    }
    console.log(`🏝️  ${posadas.length} posadas`);

    let nIncl = 0;
    for (const i of inclusiones) {
      if (!idsPosada.has(i.posada_id)) continue;
      await c.query('INSERT INTO posada_inclusiones (posada_id, texto, orden) VALUES ($1, $2, $3)',
        [i.posada_id, i.texto || '', Number(i.orden) || 0]);
      nIncl++;
    }
    console.log(`📋 ${nIncl} inclusiones`);

    for (const f of fotosOk) {
      await c.query('INSERT INTO posada_fotos (posada_id, url, orden, es_portada) VALUES ($1, $2, $3, $4)',
        [f.posada_id, f.url, Number(f.orden) || 0, !!f.es_portada]);
    }
    console.log(`🖼️  ${fotosOk.length} fotos`);

    for (const q of cotizaciones) {
      await c.query(
        `INSERT INTO cotizaciones (id, posada_id, generado_por, estado, tipo_paquete,
           pasajeros_adultos, pasajeros_ninos, pasajeros_infantes, tarifa_adulto, tarifa_nino,
           moneda, monto_total, datos_vuelo, datos_hospedaje, datos_cliente, creado_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, COALESCE($16::timestamptz, now()))
         ON CONFLICT (id) DO NOTHING`,
        [q.id, idsPosada.has(q.posada_id) ? q.posada_id : null,
         idsUsuario.has(q.generado_por) ? q.generado_por : null,
         q.estado || null, q.tipo_paquete || null,
         Number(q.pasajeros_adultos) || 0, Number(q.pasajeros_ninos) || 0, Number(q.pasajeros_infantes) || 0,
         Number(q.tarifa_adulto) || 0, Number(q.tarifa_nino) || 0, q.moneda || 'USD', Number(q.monto_total) || 0,
         q.datos_vuelo == null ? null : JSON.stringify(q.datos_vuelo),
         q.datos_hospedaje == null ? null : JSON.stringify(q.datos_hospedaje),
         q.datos_cliente == null ? null : JSON.stringify(q.datos_cliente),
         q.created_at || q.creado_at || null]);
    }
    console.log(`🧾 ${cotizaciones.length} cotizaciones`);
  });

  console.log('\n✅ Migración completada. Los usuarios entran con su misma contraseña.\n');
}

main()
  .catch((err) => {
    console.error('\n❌ Error en la migración:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
