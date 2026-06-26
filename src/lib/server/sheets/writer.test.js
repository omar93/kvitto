import { describe, it, expect, vi } from 'vitest';
import { findNextRow, buildReceiptRows, writeReceipt } from './writer.js';

const receipt = {
  store: 'Willys - Port73',
  date: '2026-04-24',
  total: 39.05,
  items: [
    { name: 'Mjölk 0,5%', price: 19.9, category: 'Mat' },
    { name: 'Cola + pant', price: 19.15, category: 'Läsk/Snäx' }
  ]
};

describe('findNextRow', () => {
  it('returns the row after the last filled cell in column J', async () => {
    const sheets = { spreadsheets: { values: { get: vi.fn().mockResolvedValue({
      data: { values: [['Groceries'], ['Willys'], ['Mjölk'], [''], []] }
    }) } } };
    expect(await findNextRow(sheets, 'SID', '2026-06/07')).toBe(4);
    expect(sheets.spreadsheets.values.get).toHaveBeenCalledWith(
      expect.objectContaining({ range: "'2026-06/07'!J1:J1000" })
    );
  });
});

describe('buildReceiptRows', () => {
  it('builds the store row with a SUM formula and item rows', () => {
    const out = buildReceiptRows({
      receipt, startRow: 5, tabName: '2026-06/07', sheetId: 7, location: 'Stockholm', card: 'Skandia'
    });
    expect(out.startRow).toBe(5);
    expect(out.lastItemRow).toBe(7);
    expect(out.valueRange.range).toBe("'2026-06/07'!J5:N7");
    expect(out.valueRange.values).toEqual([
      ['Willys - Port73', '=SUM(K6:K7)', '2026-04-24', 'Stockholm', 'Skandia'],
      ['Mjölk 0,5%', 19.9, '', 'Mat', ''],
      ['Cola + pant', 19.15, '', 'Läsk/Snäx', '']
    ]);
    expect(out.borderRequest.updateBorders.range).toEqual({
      sheetId: 7, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 9, endColumnIndex: 14
    });
    expect(out.borderRequest.updateBorders.bottom.style).toBe('SOLID_THICK');
  });
});

describe('writeReceipt', () => {
  function sheetsWith(existingJ) {
    return {
      spreadsheets: {
        get: vi.fn().mockResolvedValue({ data: { sheets: [{ properties: { title: '2026-06/07', sheetId: 7 } }] } }),
        batchUpdate: vi.fn().mockResolvedValue({ data: {} }),
        values: {
          get: vi.fn().mockResolvedValue({ data: { values: existingJ } }),
          update: vi.fn().mockResolvedValue({ data: {} }),
          batchUpdate: vi.fn().mockResolvedValue({ data: {} })
        }
      }
    };
  }

  it('dry-run returns a plan and writes nothing', async () => {
    const sheets = sheetsWith([['Groceries']]);
    const r = await writeReceipt(sheets, 'SID', receipt, { tabName: '2026-06/07', location: 'Stockholm', card: 'Skandia' });
    expect(r.applied).toBe(false);
    expect(r.plan.valueRange.range).toBe("'2026-06/07'!J2:N4");
    expect(sheets.spreadsheets.values.update).not.toHaveBeenCalled();
    expect(sheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });

  it('dry-run with a missing tab returns a plan at row 2 and creates nothing', async () => {
    const sheets = {
      spreadsheets: {
        get: vi.fn().mockResolvedValue({ data: { sheets: [{ properties: { title: 'Sheet1', sheetId: 0 } }] } }),
        batchUpdate: vi.fn(),
        values: { get: vi.fn(), update: vi.fn(), batchUpdate: vi.fn() }
      }
    };
    const r = await writeReceipt(sheets, 'SID', receipt, {
      tabName: '2026-06/07', location: 'Stockholm', card: 'Skandia', templateTab: 'Mall'
    });
    expect(r.applied).toBe(false);
    expect(r.plan.valueRange.range).toBe("'2026-06/07'!J2:N4");
    expect(sheets.spreadsheets.batchUpdate).not.toHaveBeenCalled();
    expect(sheets.spreadsheets.values.get).not.toHaveBeenCalled();
  });

  it('applies values then border when dryRun is false', async () => {
    const sheets = sheetsWith([['Groceries']]);
    const r = await writeReceipt(sheets, 'SID', receipt, {
      tabName: '2026-06/07', location: 'Stockholm', card: 'Skandia', dryRun: false
    });
    expect(r.applied).toBe(true);
    expect(sheets.spreadsheets.values.update).toHaveBeenCalledWith(expect.objectContaining({
      spreadsheetId: 'SID',
      range: "'2026-06/07'!J2:N4",
      valueInputOption: 'USER_ENTERED'
    }));
    expect(sheets.spreadsheets.batchUpdate).toHaveBeenCalledWith(expect.objectContaining({
      spreadsheetId: 'SID'
    }));
  });
});
