import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDefaultSettings, loadSettings, saveSettings, normalizeItemKey, updateSettings } from './settings.js';

let dir, file;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'kvitto-')); file = join(dir, 'settings.json'); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('normalizeItemKey', () => {
  it('lowercases and trims', () => {
    expect(normalizeItemKey('  Cola + Pant ')).toBe('cola + pant');
  });
});

describe('settings load/save', () => {
  it('returns defaults when file does not exist', async () => {
    const s = await loadSettings(file);
    expect(s).toEqual(getDefaultSettings());
  });

  it('round-trips and deep-merges over defaults', async () => {
    await writeFile(file, JSON.stringify({ lastUsed: { location: 'Göteborg' } }));
    const s = await loadSettings(file);
    expect(s.lastUsed.location).toBe('Göteborg');
    expect(s.lastUsed.card).toBe(getDefaultSettings().lastUsed.card); // preserved default
    s.learnedCategories['cola + pant'] = 'Läsk/Snäx';
    await saveSettings(file, s);
    const again = await loadSettings(file);
    expect(again.learnedCategories['cola + pant']).toBe('Läsk/Snäx');
  });
});

describe('updateSettings', () => {
  it('deep-merges a patch and persists it', async () => {
    await updateSettings(file, { lastUsed: { location: 'Stockholm' } });
    const merged = await updateSettings(file, { lastUsed: { card: 'Skandia' } });
    expect(merged.lastUsed).toEqual({ location: 'Stockholm', card: 'Skandia' });
    const reloaded = await loadSettings(file);
    expect(reloaded.lastUsed).toEqual({ location: 'Stockholm', card: 'Skandia' });
  });
});
