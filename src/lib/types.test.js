import { describe, it, expect } from 'vitest';
import { CATEGORIES } from './types.js';

describe('CATEGORIES', () => {
  it('contains the exact category strings, with "Annat" for unknowns last', () => {
    expect(CATEGORIES).toEqual(['Mat', 'Läsk/Snäx', 'Vård', 'Hem', 'Annat']);
  });
});
