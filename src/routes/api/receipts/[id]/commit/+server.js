import { json } from '@sveltejs/kit';
import { service } from '$lib/server/app.js';

export async function POST({ params }) {
  try {
    return json(await service.commit(params.id));
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}
