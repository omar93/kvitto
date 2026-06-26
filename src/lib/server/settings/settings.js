import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export function getDefaultSettings() {
  return {
    confirmations: { tab: true, category: true, storeMeta: true, finalSave: true },
    lastUsed: { location: '', card: '' },
    learnedCategories: {},
    sheet: { spreadsheetId: '', templateTab: '' },
    ollama: { host: 'http://localhost:11434', model: 'llama3.1:8b' }
  };
}

export function normalizeItemKey(name) {
  return String(name).trim().toLowerCase();
}

function deepMerge(base, override) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(override || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && typeof base?.[k] === 'object'
      ? deepMerge(base[k], v)
      : v;
  }
  return out;
}

export async function loadSettings(filePath) {
  try {
    const raw = await readFile(filePath, 'utf8');
    return deepMerge(getDefaultSettings(), JSON.parse(raw));
  } catch (err) {
    if (err.code === 'ENOENT') return getDefaultSettings();
    throw err;
  }
}

export async function saveSettings(filePath, settings) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(settings, null, 2), 'utf8');
}
