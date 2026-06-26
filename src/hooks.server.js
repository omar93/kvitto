import { service } from '$lib/server/app.js';
import { startWatcher } from '$lib/server/ingest/watcher.js';

let started = false;
async function startOnce() {
  if (started) return;
  started = true;
  const settings = await service.getSettings();
  const folder = settings.watchFolder;
  if (folder) {
    startWatcher(folder, { ingest: (input) => service.ingest(input) });
  }
}
startOnce();

export async function handle({ event, resolve }) {
  return resolve(event);
}
