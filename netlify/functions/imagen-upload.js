// netlify/functions/imagen-upload.js
// POST /api/imagen-upload — sube una foto de posada al disco del servidor
// Requiere: template:update
//
// Petición: cuerpo binario de la imagen
//   Content-Type: image/jpeg | image/png | image/webp
//   X-Posada-Id:  <id de la posada>
// Respuesta: { publicUrl: "/uploads/<posada>/<archivo>" }
//
// (Antes devolvía una URL firmada de Supabase Storage para un segundo PUT.)

const uploads = require('./_lib/uploads');
const { verificarAuth, puede, ok, error, handleOptions, fallo } = require('./_lib/auth');

const MAX_BYTES = (Number(process.env.MAX_IMAGE_MB) || 15) * 1024 * 1024;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return handleOptions();
  if (event.httpMethod !== 'POST') return error('Método no permitido', 405);

  try {
    const usuario = await verificarAuth(event);
    if (!puede(usuario, 'template:update')) return error('Sin permisos para subir imágenes', 403);

    const posadaId = event.headers['x-posada-id'];
    if (!posadaId) return error('Falta posadaId (header X-Posada-Id)', 400);

    const tipo = String(event.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!uploads.TIPOS[tipo]) return error('Tipo de archivo no permitido. Usar JPEG, PNG o WebP', 400);

    const buffer = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64')
      : Buffer.from(event.body || '', 'binary');
    if (!buffer.length) return error('Imagen vacía', 400);
    if (buffer.length > MAX_BYTES) return error('Imagen demasiado grande', 413);

    const publicUrl = await uploads.guardar(posadaId, buffer, tipo);
    return ok({ publicUrl, path: publicUrl }, 201);
  } catch (err) {
    if (err.status === 400) return error(err.message, 400);
    return fallo('imagen-upload', err);
  }
};
