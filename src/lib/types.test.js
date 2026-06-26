import { describe, it, expect } from 'vitest';
import { CATEGORIES } from './types.js';

describe('CATEGORIES', () => {
  it('contains the four exact category strings', () => {
    expect(CATEGORIES).toEqual(['Mat', 'Läsk/Snäx', 'Vård', 'Hem']);
  });
});
