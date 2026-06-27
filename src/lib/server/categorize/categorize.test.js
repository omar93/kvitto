import { describe, it, expect } from 'vitest';
import { resolveCategory, applyCategories, recordCorrection } from './categorize.js';

describe('resolveCategory', () => {
  const learned = { 'cola + pant': 'Läsk/Snäx' };

  it('prefers a learned mapping over the suggestion', () => {
    expect(resolveCategory('Cola + pant', 'Mat', learned)).toBe('Läsk/Snäx');
  });

  it('falls back to a valid suggestion', () => {
    expect(resolveCategory('Banan', 'Mat', learned)).toBe('Mat');
  });

  it('returns null for an invalid suggestion when "Annat" is not an allowed category', () => {
    expect(resolveCategory('Mystery', 'Bogus', learned, ['Mat', 'Hem'])).toBeNull();
  });

  it('falls back to "Annat" for unknowns when that category is allowed', () => {
    expect(resolveCategory('Mystery', 'Bogus', learned)).toBe('Annat');
    // a known mapping still wins over the fallback
    expect(resolveCategory('Cola + pant', null, learned)).toBe('Läsk/Snäx');
  });
});

describe('applyCategories', () => {
  it('resolves categories across items', () => {
    const items = [
      { name: 'Cola + pant', price: 15.15, category: 'Mat' },
      { name: 'Banan', price: 24.18, category: null }
    ];
    const out = applyCategories(items, { 'cola + pant': 'Läsk/Snäx' });
    expect(out.map((i) => i.category)).toEqual(['Läsk/Snäx', 'Annat']);
  });
});

describe('recordCorrection', () => {
  it('adds a normalized, valid correction without mutating the input', () => {
    const learned = {};
    const next = recordCorrection(learned, ' Tandkräm ', 'Vård');
    expect(next).toEqual({ 'tandkräm': 'Vård' });
    expect(learned).toEqual({});
  });

  it('ignores invalid categories', () => {
    expect(recordCorrection({}, 'X', 'Nope')).toEqual({});
  });
});
