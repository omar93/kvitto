import { listTabs } from './tabs.js';

// Scans the whole spreadsheet for the "Plats" (location, column M) and
// "Köpt med" (card, column N) values that have already been used, so the app can
// offer them as dropdown suggestions instead of a hardcoded list.
//
// A store-header row is identified by a non-empty date in column L; item rows
// leave L empty. That lets us read location from M on header rows without
// confusing it with the item category that lives in M on item rows.
export async function getStoreMetaLists(sheets, spreadsheetId) {
  const tabs = await listTabs(sheets, spreadsheetId);
  if (!tabs.length) return { locations: [], cards: [] };

  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: tabs.map((t) => `'${t.title}'!J1:N1000`)
  });

  const locations = new Set();
  const cards = new Set();
  for (const vr of res.data.valueRanges || []) {
    for (const row of vr.values || []) {
      const isHeader = row[2] != null && String(row[2]).trim() !== ''; // date in column L
      if (!isHeader) continue;
      const loc = String(row[3] ?? '').trim(); // column M
      const card = String(row[4] ?? '').trim(); // column N
      if (loc) locations.add(loc);
      if (card) cards.add(card);
    }
  }
  return { locations: [...locations].sort(), cards: [...cards].sort() };
}
