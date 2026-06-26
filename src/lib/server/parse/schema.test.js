import { describe, it, expect } from 'vitest';
import { validateReceipt, coercePrice } from './schema.js';

describe('coercePrice', () => {
  it('parses Swedish formatted prices', () => {
    expect(coercePrice('19,90 kr')).toBe(19.9);
    expect(coercePrice('1 241,86 kr')).toBe(1241.86); // nbsp thousands sep
    expect(coercePrice('20.62')).toBe(20.62);
    expect(coercePrice(18.83)).toBe(18.83);
  });

  it('returns null for unparseable input', () => {
    expect(coercePrice('abc')).toBeNull();
    expect(coercePrice(null)).toBeNull();
  });
});

describe('validateReceipt', () => {
  const good = {
    store: 'Willys - Port73',
    date: '2026-04-24',
    total: 241.86,
    items: [
      { name: 'Mjölk 0,5%', price: 19.9, category: 'Mat' },
      { name: 'Cola + pant', price: 15.15, category: 'Läsk/Snäx' }
    ]
  };

  it('accepts a well-formed receipt', () => {
    const r = validateReceipt(good);
    expect(r.ok).toBe(true);
    expect(r.value.items).toHaveLength(2);
  });

  it('coerces string prices and normalizes invalid categories to null', () => {
    const r = validateReceipt({
      ...good,
      total: '241,86 kr',
      items: [{ name: 'X', price: '19,90 kr', category: 'Nonsense' }]
    });
    expect(r.ok).toBe(true);
    expect(r.value.total).toBe(241.86);
    expect(r.value.items[0].price).toBe(19.9);
    expect(r.value.items[0].category).toBeNull();
  });

  it('rejects when store/date/items are missing or malformed', () => {
    expect(validateReceipt({}).ok).toBe(false);
    expect(validateReceipt({ ...good, date: '24/04/2026' }).ok).toBe(false);
    expect(validateReceipt({ ...good, items: [] }).ok).toBe(false);
  });
});
