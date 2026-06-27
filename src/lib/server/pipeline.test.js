import { describe, it, expect, vi } from 'vitest';
import { processReceipt } from './pipeline.js';

const settings = {
  ollama: { host: 'http://h:11434', model: 'm', visionModel: 'v' },
  learnedCategories: { banan: 'Mat' }
};

describe('processReceipt (PDF)', () => {
  it('extracts the text layer and parses with the text model', async () => {
    const deps = {
      extractPdfText: vi.fn().mockResolvedValue('Maxi long enough receipt text here ...'),
      parseReceipt: vi.fn().mockResolvedValue({
        store: 'Maxi', date: '2026-04-24', total: 24.18,
        items: [{ name: 'Banan', price: 24.18, deposit: 0, category: null }]
      }),
      applyCategories: (items, learned) =>
        items.map((i) => ({ ...i, category: learned[i.name.toLowerCase()] ?? i.category }))
    };
    const item = { buffer: Buffer.from('x'), filename: 'k.pdf', mimetype: 'application/pdf' };
    const r = await processReceipt(item, { settings, deps });
    expect(r.status).toBe('ready');
    expect(r.source).toBe('pdf');
    expect(r.receipt.items[0].category).toBe('Mat');
    expect(deps.parseReceipt).toHaveBeenCalledWith(
      'Maxi long enough receipt text here ...', expect.objectContaining({ host: 'http://h:11434', model: 'm' })
    );
  });

  it('uses the deterministic parser when it recognises the format (no LLM call)', async () => {
    const deps = {
      extractPdfText: vi.fn().mockResolvedValue('Start Självscanning ... long enough text'),
      parseReceiptText: vi.fn().mockReturnValue({
        store: 'Willys', date: '2026-06-15', total: 10,
        items: [{ name: 'Kasse', price: 10, quantity: 1, discount: 0, deposit: 0, category: null }]
      }),
      parseReceipt: vi.fn(),
      applyCategories: (items) => items
    };
    const item = { buffer: Buffer.from('x'), filename: 'k.pdf', mimetype: 'application/pdf' };
    const r = await processReceipt(item, { settings, deps });
    expect(r.status).toBe('ready');
    expect(r.source).toBe('pdf-parser');
    expect(deps.parseReceipt).not.toHaveBeenCalled();
  });

  it('falls back to the LLM with comma->dot numbers when the parser declines', async () => {
    const deps = {
      extractPdfText: vi.fn().mockResolvedValue('Maxi 19,90 receipt text that is long enough'),
      parseReceiptText: vi.fn().mockReturnValue(null),
      parseReceipt: vi.fn().mockResolvedValue({
        store: 'Maxi', date: '2026-04-24', total: 19.9,
        items: [{ name: 'Mjölk', price: 19.9, deposit: 0, category: 'Mat' }]
      }),
      applyCategories: (items) => items
    };
    const item = { buffer: Buffer.from('x'), filename: 'k.pdf', mimetype: 'application/pdf' };
    const r = await processReceipt(item, { settings, deps });
    expect(r.status).toBe('ready');
    expect(r.source).toBe('pdf');
    expect(deps.parseReceipt).toHaveBeenCalledWith(
      'Maxi 19.90 receipt text that is long enough', expect.objectContaining({ model: 'm' })
    );
  });

  it('errors when the PDF has no usable text layer', async () => {
    const deps = { extractPdfText: vi.fn().mockResolvedValue('   ') };
    const item = { buffer: Buffer.from('x'), mimetype: 'application/pdf' };
    const r = await processReceipt(item, { settings, deps });
    expect(r.status).toBe('error');
    expect(r.error).toMatch(/no usable text layer/i);
  });
});

describe('processReceipt (image)', () => {
  it('routes images to the vision model', async () => {
    const deps = {
      parseReceiptFromImage: vi.fn().mockResolvedValue({
        store: 'Maxi', date: '2026-04-24', total: 24.18,
        items: [{ name: 'Banan', price: 24.18, deposit: 0, category: 'Mat' }]
      }),
      applyCategories: (items) => items
    };
    const item = { buffer: Buffer.from('img'), filename: 'k.png', mimetype: 'image/png' };
    const r = await processReceipt(item, { settings, categories: ['Mat'], deps });
    expect(r.status).toBe('ready');
    expect(r.source).toBe('vision');
    expect(deps.parseReceiptFromImage).toHaveBeenCalledWith(
      item.buffer, expect.objectContaining({ host: 'http://h:11434', model: 'v', categories: ['Mat'] })
    );
  });

  it('captures vision errors without throwing', async () => {
    const deps = { parseReceiptFromImage: vi.fn().mockRejectedValue(new Error('vision boom')) };
    const item = { buffer: Buffer.from('img'), mimetype: 'image/png' };
    const r = await processReceipt(item, { settings, deps });
    expect(r.status).toBe('error');
    expect(r.error).toMatch(/vision boom/);
  });
});
