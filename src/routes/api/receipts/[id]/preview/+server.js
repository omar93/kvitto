import { json } from '@sveltejs/kit';
import { service } from '$lib/server/app.js';

export async function GET({ params }) {
  try {
    return json(await service.preview(params.id));
  } catch (err) {
    return json({ error: err.message }, { status: 500 });
  }
}
