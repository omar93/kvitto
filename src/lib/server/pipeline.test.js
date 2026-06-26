import { describe, it, expect, vi } from 'vitest';
import { processReceipt } from './pipeline.js';

const settings = {
  ollama: { host: 'http://h:11434', model: 'm' },
  learnedCategories: { banan: 'Mat' }
};
const item = { buffer: Buffer.from('x'), filename: 'k.pdf', mimetype: 'application/pdf' };

describe('processReceipt', () => {
  it('returns a ready receipt with categories applied', async () => {
    const deps = {
      extractText: vi.fn().mockResolvedValue({ text: 'RAW', source: 'pdf' }),
      parseReceipt: vi.fn().mockResolvedValue({
        store: 'Maxi', date: '2026-04-24', total: 24.18,
        items: [{ name: 'Banan', price: 24.18, category: null }]
      }),
      applyCategories: (items, learned) =>
        items.map((i) => ({ ...i, category: learned[i.name.toLowerCase()] ?? i.category }))
    };
    const r = await processReceipt(item, { settings, deps });
    expect(r.status).toBe('ready');
    expect(r.source).toBe('pdf');
    expect(r.receipt.items[0].category).toBe('Mat');
    expect(deps.parseReceipt).toHaveBeenCalledWith('RAW', { host: 'http://h:11434', model: 'm' });
  });

  it('captures errors without throwing', async () => {
    const deps = { extractText: vi.fn().mockRejectedValue(new Error('no text layer')) };
    const r = await processReceipt(item, { settings, deps });
    expect(r.status).toBe('error');
    expect(r.error).toMatch(/no text layer/);
  });
});
