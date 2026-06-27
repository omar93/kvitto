import { json } from '@sveltejs/kit';
import { service } from '$lib/server/app.js';

export async function GET() {
  try {
    return json(await service.getStoreMeta());
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}
