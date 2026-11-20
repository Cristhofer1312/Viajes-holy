// scripts/create-admin.js
// Crea (o repara) el usuario administrador maestro en Postgres.
//
// Ejecutar en el VPS:   docker compose exec app node scripts/create-admin.js
// o en local:           node scripts/create-admin.js
//
// Las credenciales se leen del entorno / .env — NUNCA están en este archivo:
//   ADMIN_EMAIL      (obligatorio)
//   ADMIN_PASSWORD   (obligatorio, mínimo 8 caracteres)
//   ADMIN_NOMBRE     (opcional, por defecto "Administrador Holy")
//   DATABASE_URL     (obligatorio)
//
// Idempotente: re-ejecutarlo rota la contraseña del admin, lo reactiva y
// cierra sus sesiones abiertas. Es el ÚNICO camino para crear otro
// administrador, porque la aplicación tiene prohibido crearlos (regla
// `asigna` en src/js/roles.js).

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool, query } = require('../netlify/functions/_lib/db');
const { hashPassword } = require('../netlify/functions/_lib/token');

const MIN_PASSWORD = 8;

function leerConfig() {
  const faltantes = ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'DATABASE_URL'].filter((k) => !process.env[k]);
  if (faltantes.length) {
    console.error('\n❌ Faltan variables de entorno:\n');
    faltantes.forEach((k) => console.error(`   ${k}`));
    console.error('\n   Agrégalas al .env (ver .env.example) o pásalas con -e.\n');
    process.exit(1);
  }
  const password = process.env.ADMIN_PASSWORD;
  if (password.length < MIN_PASSWORD) {
    console.error(`\n❌ ADMIN_PASSWORD debe tener al menos ${MIN_PASSWORD} caracteres.\n`);
    process.exit(1);
  }
  return {
    email:  process.env.ADMIN_EMAIL.trim().toLowerCase(),
    password,
    nombre: process.env.ADMIN_NOMBRE || 'Administrador Holy',
  };
}

async function createAdmin() {
  const { email, password, nombre } = leerConfig();
  console.log(`\n🔐 Administrador: ${email}`);

  const hash = await hashPassword(password);
  const { rows: existentes } = await query(
    'SELECT id, nombre, rol, activo FROM usuarios WHERE lower(email) = $1', [email]
  );

  if (existentes.length) {
    const u = existentes[0];
    // No se cambia nombre ni rol: pueden haberse editado a mano
    await query(
      `UPDATE usuarios SET password_hash = $2, activo = true, sesion_version = sesion_version + 1
        WHERE id = $1`,
      [u.id, hash]
    );
    console.log(`   ♻️  Ya existía ("${u.nombre}" · ${u.rol}): contraseña actualizada${u.activo ? '' : ' y reactivado'}`);
    if (u.rol !== 'admin') {
      console.log(`   ⚠️  Su rol es "${u.rol}", no admin. Cámbialo con:`);
      console.log(`      UPDATE usuarios SET rol = 'admin' WHERE lower(email) = '${email}';`);
    }
  } else {
    await query(
      `INSERT INTO usuarios (email, password_hash, nombre, rol, activo) VALUES ($1, $2, $3, 'admin', true)`,
      [email, hash, nombre]
    );
    console.log(`   ✅ Creado ("${nombre}" · admin · activo)`);
  }

  console.log('\n✅ Administrador listo.\n');
}

createAdmin()
  .catch(function (err) {
    console.error('\n❌ Error en create-admin:', err.message);
    process.exitCode = 1;
  })
  .finally(function () { return pool.end(); });
