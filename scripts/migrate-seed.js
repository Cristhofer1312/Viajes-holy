// scripts/migrate-seed.js
// Script de migración ONE-TIME: sube la posada del seed.js actual a Supabase
// Ejecutar UNA SOLA VEZ desde tu máquina antes del primer deploy:
//   node scripts/migrate-seed.js

'use strict';

// Requiere las variables de entorno en el archivo .env de la raíz
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const path  = require('path');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Cargar el seed directamente — es un módulo que asigna window.HOLY_SEED
// En Node.js usamos un mock de window para capturarlo
const mockWindow = {};
global.window = mockWindow;
require(path.join(__dirname, '..', 'src', 'data', 'seed.js'));
const SEED = mockWindow.HOLY_SEED;

if (!SEED) {
  console.error('❌ No se pudo cargar src/data/seed.js');
  process.exit(1);
}

console.log(`\n🌱 Migrando: "${SEED.nombrePosada}" → ${SEED.destino}`);
console.log(`   Fotos: ${(SEED.imagenesBase64 || []).length}`);
console.log(`   Inclusiones: ${(SEED.inclusiones || []).length}\n`);

// Convierte un dataURL base64 a Buffer
function dataUrlToBuffer(dataUrl) {
  const base64 = dataUrl.split(',')[1] || dataUrl;
  return Buffer.from(base64, 'base64');
}

// Detecta el tipo MIME de un dataURL
function mimeType(dataUrl) {
  const match = dataUrl.match(/^data:(image\/[a-z]+);base64,/);
  return match ? match[1] : 'image/jpeg';
}

function ext(mime) {
  return mime.split('/')[1].replace('jpeg', 'jpg');
}

async function migrate() {
  // 1. Upsert de la posada (sin imágenes)
  console.log('1/3 — Insertando posada...');
  const { error: posadaErr } = await supabase.from('posadas').upsert({
    id:                    SEED.id,
    nombre:                SEED.nombrePosada,
    destino:               SEED.destino,
    tipo_servicio_default: SEED.tipoServicioDefault || '',
    layout_fotos:          SEED.layoutFotos || 1,
    checkin_hora:          SEED.checkInHora  || '15:00',
    checkout_hora:         SEED.checkOutHora || '13:00',
    tipo_template:         SEED.tipoTemplate || 'COMPLETO',
    activa:                true,
  }, { onConflict: 'id' });
  if (posadaErr) throw posadaErr;
  console.log('   ✅ Posada insertada');

  // 2. Subir imágenes al Storage y registrar en posada_fotos
  console.log('2/3 — Subiendo imágenes...');
  const imagenes = SEED.imagenesBase64 || [];
  const fotoRows = [];

  for (var i = 0; i < imagenes.length; i++) {
    var dataUrl = imagenes[i];
    var mime    = mimeType(dataUrl);
    var buffer  = dataUrlToBuffer(dataUrl);
    var fileName = `${SEED.id}/${Date.now()}-${i}.${ext(mime)}`;

    var { error: uploadErr } = await supabase.storage
      .from('posadas-fotos')
      .upload(fileName, buffer, { contentType: mime, upsert: true });

    if (uploadErr) {
      console.warn(`   ⚠️  Foto ${i} falló: ${uploadErr.message}`);
      continue;
    }

    var { data: publicData } = supabase.storage
      .from('posadas-fotos')
      .getPublicUrl(fileName);

    fotoRows.push({
      posada_id:  SEED.id,
      url:        publicData.publicUrl,
      orden:      i,
      es_portada: i === 0,
    });

    console.log(`   ✅ Foto ${i + 1}/${imagenes.length} subida`);
  }

  if (fotoRows.length) {
    await supabase.from('posada_fotos').delete().eq('posada_id', SEED.id);
    var { error: fotosErr } = await supabase.from('posada_fotos').insert(fotoRows);
    if (fotosErr) throw fotosErr;
  }

  // 3. Insertar inclusiones
  console.log('3/3 — Insertando inclusiones...');
  const inclusiones = SEED.inclusiones || [];
  if (inclusiones.length) {
    await supabase.from('posada_inclusiones').delete().eq('posada_id', SEED.id);
    var inclRows = inclusiones.map(function (texto, idx) {
      return { posada_id: SEED.id, texto: texto, orden: idx };
    });
    var { error: inclErr } = await supabase.from('posada_inclusiones').insert(inclRows);
    if (inclErr) throw inclErr;
  }
  console.log(`   ✅ ${inclusiones.length} inclusiones insertadas`);

  console.log('\n✅ Migración completada exitosamente.');
  console.log(`   Posada "${SEED.nombrePosada}" disponible en Supabase.\n`);
}

migrate().catch(function (err) {
  console.error('\n❌ Error en la migración:', err.message);
  process.exit(1);
});
