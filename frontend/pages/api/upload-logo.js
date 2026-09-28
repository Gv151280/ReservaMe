import { put } from '@vercel/blob';

export const config = {
  api: {
    bodyParser: false, // recibimos el archivo como raw body
  },
};

const MAX_SIZE = 4 * 1024 * 1024; // 4 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // 1. Validar que quien sube sea Administrador, reenviando la cookie al backend
    const cookie = req.headers.cookie || '';
    const meResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
      headers: { cookie },
    });

    if (!meResponse.ok) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const data = await meResponse.json();
    const user = data.user;

    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (!user.roles.includes('administrador')) {
      return res.status(403).json({ error: 'Solo un administrador puede subir el logo' });
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

    // 4. Subir a Vercel Blob
    const extension = contentType === 'image/png' ? 'png' : 'jpg';
    const filename = `logos/colegio-${user.colegioId}-${Date.now()}.${extension}`;

    const blob = await put(filename, buffer, {
      access: 'public',
      contentType,
    });

    // 5. Devolver la URL pública
    return res.status(200).json({ url: blob.url });

  } catch (error) {
    console.error('[upload-logo] Error:', error);
    return res.status(500).json({ error: 'Error al subir el logo' });
  }
}
