import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createService } from './service.js';

let dir, settingsPath;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'kvitto-')); settingsPath = join(dir, 's.json'); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

const readyReceipt = {
  store: 'Willys', date: '2026-04-24', total: 19.9,
  items: [{ name: 'Mjölk', price: 19.9, category: 'Mat' }]
};

function baseConfig(extra = {}) {
  return {
    settingsPath, spreadsheetId: 'SID', templateTab: 'Mall', keyFile: 'k.json',
    now: () => new Date('2026-06-26T10:00:00'),
    deps: {
      processReceipt: vi.fn().mockResolvedValue({ status: 'ready', text: 'RAW', source: 'pdf', receipt: readyReceipt }),
      createSheetsClient: vi.fn().mockReturnValue({ __sheets: true }),
      ...extra
    }
  };
}

describe('service.ingest', () => {
  it('processes a receipt and sets meta defaults (tab from now, location/card from lastUsed)', async () => {
    const svc = createService(baseConfig());
    await svc.updateSettings({ lastUsed: { location: 'Stockholm', card: 'Skandia' } });
    const item = await svc.ingest({ buffer: Buffer.from('x'), filename: 'k.pdf', mimetype: 'application/pdf', source: 'upload' });
    expect(item.status).toBe('ready');
    expect(item.receipt.store).toBe('Willys');
    expect(item.meta).toEqual({ location: 'Stockholm', card: 'Skandia', tab: '2026-06/07' });
    expect(item.buffer).toBeUndefined();
  });
});

describe('service.commit', () => {
  it('writes (dryRun false), records corrections, updates lastUsed, marks committed', async () => {
    const writeReceipt = vi.fn().mockResolvedValue({ applied: true, plan: { valueRange: { range: "'2026-06/07'!J2:N3" } } });
    const svc = createService(baseConfig({ writeReceipt }));
    const item = await svc.ingest({ buffer: Buffer.from('x'), filename: 'k.pdf', mimetype: 'application/pdf', source: 'upload' });
    svc.update(item.id, { meta: { location: 'Göteborg', card: 'Amex', tab: '2026-06/07' } });

    const res = await svc.commit(item.id);
    expect(res.applied).toBe(true);
    expect(writeReceipt).toHaveBeenCalledWith(
      { __sheets: true }, 'SID', readyReceipt,
      expect.objectContaining({ tabName: '2026-06/07', location: 'Göteborg', card: 'Amex', templateTab: 'Mall', dryRun: false })
    );
    expect(svc.getPublic(item.id).status).toBe('committed');

    const s = await svc.getSettings();
    expect(s.learnedCategories['mjölk']).toBe('Mat');
    expect(s.lastUsed).toEqual({ location: 'Göteborg', card: 'Amex' });
  });
});

describe('sheet config precedence', () => {
  it('prefers settings.sheet over the static config', async () => {
    const writeReceipt = vi.fn().mockResolvedValue({ applied: false, plan: {} });
    const svc = createService(baseConfig({ writeReceipt }));
    await svc.updateSettings({ sheet: { spreadsheetId: 'FROM_SETTINGS', templateTab: 'Mall2' } });
    const item = await svc.ingest({ buffer: Buffer.from('x'), filename: 'k.pdf', mimetype: 'application/pdf', source: 'upload' });
    await svc.preview(item.id);
    expect(writeReceipt).toHaveBeenCalledWith(
      { __sheets: true }, 'FROM_SETTINGS', readyReceipt,
      expect.objectContaining({ templateTab: 'Mall2', dryRun: true })
    );
  });
});

describe('service.preview', () => {
  it('calls writeReceipt with dryRun true', async () => {
    const writeReceipt = vi.fn().mockResolvedValue({ applied: false, plan: { valueRange: { range: 'X' } } });
    const svc = createService(baseConfig({ writeReceipt }));
    const item = await svc.ingest({ buffer: Buffer.from('x'), filename: 'k.pdf', mimetype: 'application/pdf', source: 'upload' });
    await svc.preview(item.id);
    expect(writeReceipt).toHaveBeenCalledWith(
      { __sheets: true }, 'SID', readyReceipt, expect.objectContaining({ dryRun: true })
    );
  });
});
