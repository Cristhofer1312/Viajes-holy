// scripts/create-admin.js
// Crea (o repara) el usuario administrador maestro.
//
// Ejecutar con: node scripts/create-admin.js
//
// Las credenciales se leen del .env — NUNCA están en este archivo:
//   ADMIN_EMAIL      (obligatorio)
//   ADMIN_PASSWORD   (obligatorio, mínimo 8 caracteres)
//   ADMIN_NOMBRE     (opcional, por defecto "Administrador Holy")
//
// El script es idempotente: se puede re-ejecutar para rotar la contraseña
// del admin o para reparar un alta a medias. Es el ÚNICO camino para crear
// otro administrador, porque la aplicación tiene prohibido crearlos
// (regla `asigna` en src/js/roles.js).

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const MIN_PASSWORD = 8;

// ─── Validación de entrada ──────────────────────────────────────────────────

function leerConfig() {
  const faltantes = ['ADMIN_EMAIL', 'ADMIN_PASSWORD']
    .filter((k) => !process.env[k]);

  if (faltantes.length) {
    console.error('\n❌ Faltan variables de entorno en .env:\n');
    faltantes.forEach((k) => console.error(`   ${k}`));
    console.error('\n   Agrégalas al archivo .env de la raíz y vuelve a ejecutar.');
    console.error('   Ver .env.example para el formato.\n');
    process.exit(1);
  }

  const password = process.env.ADMIN_PASSWORD;
  if (password.length < MIN_PASSWORD) {
    console.error(`\n❌ ADMIN_PASSWORD debe tener al menos ${MIN_PASSWORD} caracteres.\n`);
    process.exit(1);
  }

  return {
    email:    process.env.ADMIN_EMAIL.trim(),
    password,
    nombre:   process.env.ADMIN_NOMBRE || 'Administrador Holy',
  };
}

// ─── Utilidades ─────────────────────────────────────────────────────────────

/** Busca un usuario en Supabase Auth por email. La admin API no filtra por email. */
async function buscarEnAuth(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data.users || []).find((u) => (u.email || '').toLowerCase() === email.toLowerCase()) || null;
}

/**
 * Garantiza que exista el perfil en la tabla `usuarios`.
 * No sobrescribe `nombre` ni `rol` si la fila ya existe: pueden haber sido
 * modificados a mano desde el panel de Supabase.
 */
async function asegurarPerfil(userId, nombre) {
  const { data: existente, error: selErr } = await supabase
    .from('usuarios')
    .select('id, nombre, rol, activo')
    .eq('id', userId)
    .maybeSingle();

  if (selErr) throw selErr;

  if (existente) {
    if (existente.activo) {
      console.log(`   ✅ Perfil existente ("${existente.nombre}" · ${existente.rol}) — sin cambios`);
    } else {
      const { error: actErr } = await supabase
        .from('usuarios')
        .update({ activo: true })
        .eq('id', userId);
      if (actErr) throw actErr;
      console.log('   ♻️  Perfil reactivado (estaba inactivo)');
    }
    return;
  }

  const { error: insErr } = await supabase.from('usuarios').insert({
    id:     userId,
    nombre,
    rol:    'admin',
    activo: true,
  });
  if (insErr) throw insErr;
  console.log(`   ✅ Perfil creado ("${nombre}" · admin · activo)`);
}

// ─── Flujo principal ────────────────────────────────────────────────────────

async function createAdmin() {
  const { email, password, nombre } = leerConfig();

  console.log(`\n🔐 Administrador: ${email}`);

  // 1. Usuario en Supabase Auth (crear o rotar la contraseña)
  const existente = await buscarEnAuth(email);
  let userId;

  if (existente) {
    const { error } = await supabase.auth.admin.updateUserById(existente.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;

    userId = existente.id;
    console.log('   ♻️  El usuario ya existía: contraseña actualizada y email confirmado');
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // sin requisito de confirmar por correo
    });
    if (error) throw error;

    userId = data.user.id;
    console.log('   ✅ Usuario creado en Supabase Auth');
  }

  // 2. Perfil con rol en la tabla `usuarios`
  await asegurarPerfil(userId, nombre);

  console.log('\n✅ Administrador listo.');
  console.log('────────────────────────────────────────');
  console.log(`   Email:      ${email}`);
  console.log(`   Contraseña: ${'*'.repeat(12)}  (definida en ADMIN_PASSWORD)`);
  console.log('────────────────────────────────────────\n');
}

createAdmin().catch(function (err) {
  console.error('\n❌ Error en create-admin:', err.message);
  process.exit(1);
});
