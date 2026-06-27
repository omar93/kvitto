import { describe, it, expect, vi } from 'vitest';
import { findNextRow, buildReceiptRows, writeReceipt, itemPriceCell } from './writer.js';

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

    // bold on J:L of the store header row (row 5)
    const bold = out.formatRequests.find((r) => r.repeatCell);
    expect(bold.repeatCell.range).toEqual({
      sheetId: 7, startRowIndex: 4, endRowIndex: 5, startColumnIndex: 9, endColumnIndex: 12
    });
    expect(bold.repeatCell.cell.userEnteredFormat.textFormat.bold).toBe(true);

    // a thin line under the store header row, and a thick separator under the last item row
    const borders = out.formatRequests.filter((r) => r.updateBorders);
    const headerLine = borders.find((b) => b.updateBorders.range.startRowIndex === 4);
    const separator = borders.find((b) => b.updateBorders.range.startRowIndex === 6);
    expect(headerLine.updateBorders.bottom.style).toBe('SOLID');
    expect(separator.updateBorders.bottom.style).toBe('SOLID_THICK');
    expect(separator.updateBorders.range).toEqual({
      sheetId: 7, startRowIndex: 6, endRowIndex: 7, startColumnIndex: 9, endColumnIndex: 14
    });
  });
});

describe('buildReceiptRows with deposit', () => {
  it('uses =SUM(price+pant) for an item that has a deposit', () => {
    const r2 = { store: 'S', date: '2026-04-24', total: 15, items: [{ name: 'Cola', price: 13, deposit: 2, category: 'Läsk/Snäx' }] };
    const out = buildReceiptRows({ receipt: r2, startRow: 2, tabName: 'T', sheetId: 1, location: '', card: '' });
    expect(out.valueRange.values[1]).toEqual(['Cola', '=SUM(13+2)', '', 'Läsk/Snäx', '']);
  });
});

describe('itemPriceCell', () => {
  it('is a plain number when there is nothing to compute', () => {
    expect(itemPriceCell({ price: 24.18 })).toBe(24.18);
    expect(itemPriceCell({ price: 24.18, discount: 0, quantity: 1, deposit: 0 })).toBe(24.18);
  });

  it('keeps =SUM(price+pant) for deposit-only items', () => {
    expect(itemPriceCell({ price: 13, deposit: 2 })).toBe('=SUM(13+2)');
  });

  it('subtracts a flat line discount', () => {
    expect(itemPriceCell({ price: 14.9, discount: 5 })).toBe('=SUM(14.9-5)');
  });

  it('multiplies by quantity', () => {
    expect(itemPriceCell({ price: 14.9, quantity: 2 })).toBe('=SUM(14.9*2)');
  });

  it('handles a weight item with a discount modifier', () => {
    expect(itemPriceCell({ price: 112.62, quantity: 1.002, discount: 22.77 })).toBe('=SUM(112.62*1.002-22.77)');
  });

  it('adds the pant line total to a multi-quantity item (cola 3-pack)', () => {
    expect(itemPriceCell({ price: 13.15, quantity: 3, deposit: 6 })).toBe('=SUM(13.15*3+6)');
  });

  it('combines quantity, discount and pant modifiers', () => {
    expect(itemPriceCell({ price: 15, quantity: 4, discount: 8, deposit: 6 })).toBe('=SUM(15*4-8+6)');
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
