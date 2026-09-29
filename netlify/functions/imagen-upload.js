// netlify/functions/imagen-upload.js
// POST /api/imagen-upload — genera una URL firmada para subir una foto al Storage
// Requiere: template:update

const { supabase } = require('./_lib/supabase');
const { verificarAuth, puede, ok, error, handleOptions } = require('./_lib/auth');

// Genera un ID único tipo ULID simplificado
function uid() {
  return Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 8).toUpperCase();
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();

  try {
    const usuario = await verificarAuth(event);
    if (!puede(usuario, 'template:update')) return error('Sin permisos para subir imágenes', 403);

    const body = JSON.parse(event.body || '{}');
    const { posadaId, contentType } = body;

    if (!posadaId) return error('Falta posadaId', 400);

    // Validar tipo de archivo
    const tiposPermitidos = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const tipo = contentType || 'image/jpeg';
    if (!tiposPermitidos.includes(tipo)) return error('Tipo de archivo no permitido. Usar JPEG, PNG o WebP', 400);

    const ext = tipo.split('/')[1].replace('jpeg', 'jpg');
    const fileName = `${posadaId}/${uid()}.${ext}`;

    // Crear URL firmada para subida directa desde el navegador
    const { data, error: signErr } = await supabase.storage
      .from('posadas-fotos')
      .createSignedUploadUrl(fileName);

    if (signErr) throw signErr;

    // URL pública que tendrá la foto después de subida
    const { data: publicData } = supabase.storage
      .from('posadas-fotos')
      .getPublicUrl(fileName);

    return ok({
      signedUrl:  data.signedUrl,   // URL para hacer PUT de la imagen (expira en 60s)
      token:      data.token,
      path:       fileName,
      publicUrl:  publicData.publicUrl, // URL pública permanente para guardar en la BD
    });
  } catch (err) {
    console.error('[imagen-upload]', err.message);
    return error(err.message, 500);
  }
};
