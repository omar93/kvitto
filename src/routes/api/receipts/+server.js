import { json } from '@sveltejs/kit';
import { service } from '$lib/server/app.js';

export async function GET() {
  return json(service.listPublic());
}

// The file is sent as the raw request body with its real content-type (e.g.
// application/pdf, image/png) and the name in an x-filename header. This avoids
// multipart/form-data, which SvelteKit's CSRF protection would otherwise block.
export async function POST({ request }) {
  const mimetype = request.headers.get('content-type') || 'application/octet-stream';
  const rawName = request.headers.get('x-filename');
  const filename = rawName ? decodeURIComponent(rawName) : 'pasted';
  const buffer = Buffer.from(await request.arrayBuffer());
  if (buffer.length === 0) return json({ error: 'empty body' }, { status: 400 });
  const item = await service.ingest({ buffer, filename, mimetype, source: 'upload' });
  return json(item);
}
