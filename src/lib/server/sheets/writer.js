import { resolveTab, findTab } from './tabs.js';

// Column J is the 10th column (0-indexed 9); N is index 13 -> end-exclusive 14.
const COL_J_INDEX = 9;
const COL_L_END = 12; // J:L (name, sum, date) end-exclusive
const COL_N_END = 14;
const BLACK = { red: 0, green: 0, blue: 0 };

/**
 * The K-cell for one item, as a formula a human can inspect. The base is the
 * unit price (times quantity/weight), then each modifier from an indented line
 * is applied by its sign: discount subtracted, pant added (both flat line totals).
 *   price 24.18                                  -> 24.18                  (plain)
 *   price 14.9, discount 5                       -> =SUM(14.9-5)
 *   price 14.9, qty 2                            -> =SUM(14.9*2)
 *   price 112.62, qty 1.002 (kg), discount 22.77 -> =SUM(112.62*1.002-22.77)
 *   price 13, pant 2                             -> =SUM(13+2)
 *   price 13.15, qty 3, pant 6                   -> =SUM(13.15*3+6)
 */
export function itemPriceCell(it) {
  const p = it.price;
  const d = it.discount > 0 ? it.discount : 0;
  const pant = it.deposit > 0 ? it.deposit : 0;
  const q = it.quantity != null && it.quantity > 0 ? it.quantity : 1;
  const multi = q !== 1;

  // Nothing to compute: keep a plain number so simple cells stay clean.
  if (d === 0 && pant === 0 && !multi) return p;

  let expr = multi ? `${p}*${q}` : `${p}`;
  if (d > 0) expr += `-${d}`;
  if (pant > 0) expr += `+${pant}`;
  return `=SUM(${expr})`;
}

export async function findNextRow(sheets, spreadsheetId, tabName) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${tabName}'!J1:J1000`
  });
  const rows = res.data.values || [];
  let lastFilled = 0;
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i] && rows[i][0];
    if (cell != null && String(cell).trim() !== '') lastFilled = i + 1; // 1-based
  }
  return lastFilled + 1;
}

export function buildReceiptRows({ receipt, startRow, tabName, sheetId, location, card }) {
  const firstItemRow = startRow + 1;
  const lastItemRow = startRow + receipt.items.length;

  // Safety net: a name starting with = + @ would be parsed as a formula by Sheets.
  const safeText = (s) => (typeof s === 'string' ? s.replace(/^\s*[=+@]+\s*/, '') : s);

  const storeRow = [safeText(receipt.store), `=SUM(K${firstItemRow}:K${lastItemRow})`, receipt.date, location, card];
  const itemRows = receipt.items.map((it) => [safeText(it.name), itemPriceCell(it), '', it.category ?? '', '']);

  const bottomBorder = (row, style) => ({
    updateBorders: {
      range: {
        sheetId,
        startRowIndex: row - 1,
        endRowIndex: row,
        startColumnIndex: COL_J_INDEX,
        endColumnIndex: COL_N_END
      },
      bottom: { style, color: BLACK }
    }
  });

  // Bold the store header row's name / sum / date (J:L).
  const boldHeader = {
    repeatCell: {
      range: {
        sheetId,
        startRowIndex: startRow - 1,
        endRowIndex: startRow,
        startColumnIndex: COL_J_INDEX,
        endColumnIndex: COL_L_END
      },
      cell: { userEnteredFormat: { textFormat: { bold: true } } },
      fields: 'userEnteredFormat.textFormat.bold'
    }
  };

  return {
    startRow,
    lastItemRow,
    valueRange: {
      range: `'${tabName}'!J${startRow}:N${lastItemRow}`,
      values: [storeRow, ...itemRows]
    },
    formatRequests: [
      boldHeader,
      bottomBorder(startRow, 'SOLID'), // line under the store header row
      bottomBorder(lastItemRow, 'SOLID_THICK') // thick separator between purchases
    ]
  };
}

/**
 * @returns {Promise<{ plan: ReturnType<typeof buildReceiptRows>, applied: boolean }>}
 */
export async function writeReceipt(sheets, spreadsheetId, receipt, opts) {
  const { tabName, location, card, templateTab, create = true, dryRun = true } = opts;

  // Dry-run must never write: only look the tab up, never create it.
  let tab = await findTab(sheets, spreadsheetId, tabName);
  let startRow;
  if (tab) {
    startRow = await findNextRow(sheets, spreadsheetId, tab.title);
  } else if (dryRun) {
    // The tab would be created on commit; show a best-effort plan at row 2.
    tab = { title: tabName, sheetId: 0 };
    startRow = 2;
  } else {
    tab = await resolveTab(sheets, spreadsheetId, tabName, { templateTab, create });
    startRow = await findNextRow(sheets, spreadsheetId, tab.title);
  }

  const plan = buildReceiptRows({ receipt, startRow, tabName: tab.title, sheetId: tab.sheetId, location, card });

  if (dryRun) return { plan, applied: false };

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: plan.valueRange.range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: plan.valueRange.values }
  });
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: plan.formatRequests }
  });
  return { plan, applied: true };
}
