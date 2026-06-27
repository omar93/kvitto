import { describe, it, expect } from 'vitest';
import { validateReceipt, coercePrice, cleanName } from './schema.js';

describe('cleanName', () => {
  it('strips a leading formula trigger', () => {
    expect(cleanName('=pant')).toBe('pant');
    expect(cleanName('  =  Pant')).toBe('Pant');
    expect(cleanName('+rabatt')).toBe('rabatt');
    expect(cleanName('Mjölk 0,5%')).toBe('Mjölk 0,5%');
  });
});

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

  it('captures deposit (pant) per item, defaults to 0, and includes it in the total', () => {
    const r = validateReceipt({
      store: 'X', date: '2026-04-24',
      items: [
        { name: 'Cola', price: 13, deposit: 2, category: 'Läsk/Snäx' },
        { name: 'Banan', price: 24.18, category: 'Mat' }
      ]
    });
    expect(r.ok).toBe(true);
    expect(r.value.items[0].deposit).toBe(2);
    expect(r.value.items[1].deposit).toBe(0);
    expect(r.value.total).toBeCloseTo(39.18, 2);
  });

  it('captures discount + quantity (defaults 0 and 1) and reflects them in the total', () => {
    const r = validateReceipt({
      store: 'X', date: '2026-04-24',
      items: [
        { name: 'Läsk -R', price: 15, discount: 2, quantity: 4, deposit: 2, category: 'Läsk/Snäx' },
        { name: 'Banan', price: 24.18, category: 'Mat' }
      ]
    });
    expect(r.ok).toBe(true);
    expect(r.value.items[0]).toMatchObject({ discount: 2, quantity: 4, deposit: 2 });
    expect(r.value.items[1]).toMatchObject({ discount: 0, quantity: 1, deposit: 0 });
    // (15-2)*4 + 2*4 = 60, plus 24.18
    expect(r.value.total).toBeCloseTo(84.18, 2);
  });

  it('rejects when store/date/items are missing or malformed', () => {
    expect(validateReceipt({}).ok).toBe(false);
    expect(validateReceipt({ ...good, date: '24/04/2026' }).ok).toBe(false);
    expect(validateReceipt({ ...good, items: [] }).ok).toBe(false);
  });
});
