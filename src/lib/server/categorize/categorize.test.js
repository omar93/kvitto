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

  it('returns null for an invalid suggestion and no learned entry', () => {
    expect(resolveCategory('Mystery', 'Bogus', learned)).toBeNull();
  });
});

describe('applyCategories', () => {
  it('resolves categories across items', () => {
    const items = [
      { name: 'Cola + pant', price: 15.15, category: 'Mat' },
      { name: 'Banan', price: 24.18, category: null }
    ];
    const out = applyCategories(items, { 'cola + pant': 'Läsk/Snäx' });
    expect(out.map((i) => i.category)).toEqual(['Läsk/Snäx', null]);
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
