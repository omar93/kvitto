import { describe, it, expect, vi } from 'vitest';
import { getStoreMetaLists } from './store-meta.js';

describe('getStoreMetaLists', () => {
  it('collects locations (M) and cards (N) from store-header rows across all tabs', async () => {
    const sheets = {
      spreadsheets: {
        get: vi.fn().mockResolvedValue({
          data: { sheets: [
            { properties: { title: '2026-05/06', sheetId: 1 } },
            { properties: { title: '2026-06/07', sheetId: 2 } }
          ] }
        }),
        values: {
          batchGet: vi.fn().mockResolvedValue({
            data: {
              valueRanges: [
                { values: [
                  // header row: date in L (index 2), location in M, card in N
                  ['Willys', '=SUM(K2:K3)', '2026-05-02', 'Haninge', 'Skandia'],
                  // item rows: empty L, M holds the category (must be ignored)
                  ['Mjölk', 19.9, '', 'Mat', ''],
                  ['Cola', '=SUM(13+2)', '', 'Läsk/Snäx', '']
                ] },
                { values: [
                  ['Maxi', '=SUM(K2:K2)', '2026-06-10', 'Globen', 'Amex'],
                  ['Banan', 24.18, '', 'Mat', '']
                ] }
              ]
            }
          })
        }
      }
    };

    const out = await getStoreMetaLists(sheets, 'SID');
    expect(out.locations).toEqual(['Globen', 'Haninge']);
    expect(out.cards).toEqual(['Amex', 'Skandia']);
    expect(sheets.spreadsheets.values.batchGet).toHaveBeenCalledWith(expect.objectContaining({
      ranges: ["'2026-05/06'!J1:N1000", "'2026-06/07'!J1:N1000"]
    }));
  });

  it('returns empty lists when there are no tabs', async () => {
    const sheets = { spreadsheets: { get: vi.fn().mockResolvedValue({ data: { sheets: [] } }), values: { batchGet: vi.fn() } } };
    expect(await getStoreMetaLists(sheets, 'SID')).toEqual({ locations: [], cards: [] });
  });
});
