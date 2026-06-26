import { resolveTab, findTab } from './tabs.js';

// Column J is the 10th column (0-indexed 9); N is index 13 -> end-exclusive 14.
const COL_J_INDEX = 9;
const COL_N_END = 14;

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

  const storeRow = [receipt.store, `=SUM(K${firstItemRow}:K${lastItemRow})`, receipt.date, location, card];
  const itemRows = receipt.items.map((it) => [it.name, it.price, '', it.category ?? '', '']);

  return {
    startRow,
    lastItemRow,
    valueRange: {
      range: `'${tabName}'!J${startRow}:N${lastItemRow}`,
      values: [storeRow, ...itemRows]
    },
    borderRequest: {
      updateBorders: {
        range: {
          sheetId,
          startRowIndex: lastItemRow - 1,
          endRowIndex: lastItemRow,
          startColumnIndex: COL_J_INDEX,
          endColumnIndex: COL_N_END
        },
        bottom: { style: 'SOLID_THICK', color: { red: 0, green: 0, blue: 0 } }
      }
    }
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
    requestBody: { requests: [plan.borderRequest] }
  });
  return { plan, applied: true };
}
