import { json } from '@sveltejs/kit';
import { service } from '$lib/server/app.js';

export async function GET() {
  return json(await service.getSettings());
}

export async function PUT({ request }) {
  const patch = await request.json();
  return json(await service.updateSettings(patch));
}
