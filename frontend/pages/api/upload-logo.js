import { put } from '@vercel/blob';
import jwt from 'jsonwebtoken';

export const config = {
  api: {
    bodyParser: false,
  },
};

const MAX_SIZE = 4 * 1024 * 1024; // 4 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // 1. Validar el ticket emitido por el backend
    const ticket = req.headers['x-upload-ticket'];
    if (!ticket) {
      return res.status(401).json({ error: 'Falta el ticket de autorización.' });
    }

    let payload;
    try {
      payload = jwt.verify(ticket, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Ticket inválido o expirado.' });
    }

    if (payload.purpose !== 'upload-logo' || !payload.colegioId) {
      return res.status(401).json({ error: 'Ticket inválido.' });
    }

    // 2. Validar tipo de contenido
    const contentType = req.headers['content-type'];
    if (!ALLOWED_TYPES.includes(contentType)) {
      return res.status(400).json({ error: 'Formato no válido. Solo JPG o PNG.' });
    }

    // 3. Leer el body como buffer y validar tamaño
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({ error: 'El archivo supera los 4 MB.' });
    }

    // 4. Subir a Vercel Blob (autenticación automática vía OIDC, sin token)
    const extension = contentType === 'image/png' ? 'png' : 'jpg';
    const filename = `logos/colegio-${payload.colegioId}-${Date.now()}.${extension}`;

    const blob = await put(filename, buffer, {
      access: 'public',
      contentType,
    });

    return res.status(200).json({ url: blob.url });

  } catch (error) {
    console.error('[upload-logo] Error:', error);
    return res.status(500).json({ error: 'No se pudo subir el logo.' });
  }
}
