import { describe, it, expect, vi } from 'vitest';
import { parseReceiptFromImage } from './vision.js';

const sample = {
  store: 'Maxi - Haninge', date: '2026-04-24', total: 24.18,
  items: [{ name: 'Banan', price: 24.18, deposit: 0, category: 'Mat' }]
};
const okBody = (obj) => ({ ok: true, json: async () => ({ response: JSON.stringify(obj) }) });

describe('parseReceiptFromImage', () => {
  it('sends the image as base64 and returns validated data', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okBody(sample));
    const r = await parseReceiptFromImage(Buffer.from('PNGDATA'), {
      host: 'http://h:11434', model: 'vision', categories: ['Mat'], fetchImpl
    });
    expect(r.store).toBe('Maxi - Haninge');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://h:11434/api/generate');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ model: 'vision', stream: false, format: 'json' });
    expect(body.images).toEqual([Buffer.from('PNGDATA').toString('base64')]);
  });

  it('retries once on invalid JSON then succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ response: 'nope' }) })
      .mockResolvedValueOnce(okBody(sample));
    const r = await parseReceiptFromImage(Buffer.from('x'), { host: 'http://h', model: 'v', fetchImpl });
    expect(r.store).toBe('Maxi - Haninge');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws after two invalid responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: '{}' }) });
    await expect(parseReceiptFromImage(Buffer.from('x'), { host: 'http://h', model: 'v', fetchImpl }))
      .rejects.toThrow(/could not parse receipt image/i);
  });
});
