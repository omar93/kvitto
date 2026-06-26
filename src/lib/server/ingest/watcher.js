import { readFile as fsReadFile } from 'node:fs/promises';
import { basename, extname } from 'node:path';
import chokidar from 'chokidar';

const MIME = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

export function mimeFromName(name) {
  return MIME[extname(name).toLowerCase()] || null;
}

export async function handleNewFile(path, { readFile = fsReadFile, ingest }) {
  const mimetype = mimeFromName(path);
  if (!mimetype) return;
  const buffer = await readFile(path);
  await ingest({ buffer, filename: basename(path), mimetype, source: 'folder' });
}

export function startWatcher(folder, { ingest, watch = chokidar.watch }) {
  const watcher = watch(folder, { ignoreInitial: true });
  watcher.on('add', (path) => {
    handleNewFile(path, { ingest }).catch((err) => console.error('[watcher]', err.message));
  });
  console.log(`[watcher] watching ${folder}`);
  return watcher;
}
