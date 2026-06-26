import { describe, it, expect } from 'vitest';
import { tabNameForYmd, tabNameForDateString } from './period.js';

describe('tabNameForYmd', () => {
  it('uses current month as start on/after the 25th', () => {
    expect(tabNameForYmd(2026, 6, 25)).toBe('2026-06/07');
    expect(tabNameForYmd(2026, 6, 30)).toBe('2026-06/07');
  });

  it('uses previous month as start before the 25th', () => {
    expect(tabNameForYmd(2026, 7, 24)).toBe('2026-06/07');
    expect(tabNameForYmd(2026, 6, 1)).toBe('2026-05/06');
  });

  it('wraps January back to previous December', () => {
    expect(tabNameForYmd(2026, 1, 10)).toBe('2025-12/01');
  });

  it('names a December start period as 12/01', () => {
    expect(tabNameForYmd(2026, 12, 26)).toBe('2026-12/01');
  });
});

describe('tabNameForDateString', () => {
  it('parses YYYY-MM-DD without timezone drift', () => {
    expect(tabNameForDateString('2026-04-24')).toBe('2026-03/04');
    expect(tabNameForDateString('2026-04-25')).toBe('2026-04/05');
  });
});
