import { describe, it, expect, vi } from 'vitest';
import { buildPrompt, parseReceipt } from './parse.js';

const okBody = (obj) => ({ ok: true, json: async () => ({ response: JSON.stringify(obj) }) });

const sample = {
  store: 'Willys - Port73',
  date: '2026-04-24',
  total: 241.86,
  items: [{ name: 'Mjölk 0,5%', price: 19.9, category: 'Mat' }]
};

describe('buildPrompt', () => {
  it('includes the raw text and the allowed categories', () => {
    const p = buildPrompt('RAWRECEIPT');
    expect(p).toContain('RAWRECEIPT');
    expect(p).toContain('Läsk/Snäx');
    expect(p).toMatch(/json/i);
  });
});

describe('parseReceipt', () => {
  it('calls Ollama and returns validated data', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okBody(sample));
    const r = await parseReceipt('raw', { host: 'http://h:11434', model: 'm', fetchImpl });
    expect(r.store).toBe('Willys - Port73');
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://h:11434/api/generate');
    expect(JSON.parse(init.body)).toMatchObject({ model: 'm', stream: false, format: 'json' });
  });

  it('retries once on invalid output then succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ response: 'not json' }) })
      .mockResolvedValueOnce(okBody(sample));
    const r = await parseReceipt('raw', { host: 'http://h:11434', model: 'm', fetchImpl });
    expect(r.store).toBe('Willys - Port73');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws after two invalid responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ response: '{}' }) });
    await expect(parseReceipt('raw', { host: 'http://h:11434', model: 'm', fetchImpl }))
      .rejects.toThrow(/could not parse/i);
  });
});
