import { describe, it, expect, vi } from 'vitest';
import { getCategoriesFromSheet } from './categories.js';

function gridWith(dataValidation) {
  return {
    spreadsheets: {
      get: vi.fn().mockResolvedValue({
        data: { sheets: [{ data: [{ rowData: [{ values: [{ dataValidation }] }] }] }] }
      }),
      values: { get: vi.fn() }
    }
  };
}

describe('getCategoriesFromSheet', () => {
  it('reads a ONE_OF_LIST validation', async () => {
    const s = gridWith({ condition: { type: 'ONE_OF_LIST', values: [{ userEnteredValue: 'Mat' }, { userEnteredValue: 'Vård' }] } });
    expect(await getCategoriesFromSheet(s, 'SID', 'Mall')).toEqual(['Mat', 'Vård']);
  });

  it('resolves a ONE_OF_RANGE validation by reading the range', async () => {
    const s = gridWith({ condition: { type: 'ONE_OF_RANGE', values: [{ userEnteredValue: '=Listor!A1:A3' }] } });
    s.spreadsheets.values.get.mockResolvedValue({ data: { values: [['Mat'], ['Städ'], ['']] } });
    expect(await getCategoriesFromSheet(s, 'SID', 'Mall')).toEqual(['Mat', 'Städ']);
    expect(s.spreadsheets.values.get).toHaveBeenCalledWith({ spreadsheetId: 'SID', range: 'Listor!A1:A3' });
  });

  it('returns null when there is no validation', async () => {
    const s = gridWith(undefined);
    expect(await getCategoriesFromSheet(s, 'SID', 'Mall')).toBeNull();
  });
});
