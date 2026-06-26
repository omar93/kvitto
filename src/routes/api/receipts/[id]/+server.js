import { json } from '@sveltejs/kit';
import { service } from '$lib/server/app.js';

export async function GET({ params }) {
  const item = service.getPublic(params.id);
  return item ? json(item) : json({ error: 'not found' }, { status: 404 });
}

export async function PATCH({ params, request }) {
  const patch = await request.json();
  const item = service.update(params.id, patch);
  return item ? json(item) : json({ error: 'not found' }, { status: 404 });
}

export async function DELETE({ params }) {
  return json({ ok: service.remove(params.id) });
}
