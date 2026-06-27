// Reads the allowed values of the category dropdown (column M) from the sheet's
// data validation, so the app uses the user's real categories instead of a
// hardcoded list. Returns string[] or null if no validation is found.
export async function getCategoriesFromSheet(sheets, spreadsheetId, tabName) {
  const res = await sheets.spreadsheets.get({
    spreadsheetId,
    ranges: [`'${tabName}'!M2:M50`],
    includeGridData: true,
    fields: 'sheets.data.rowData.values.dataValidation'
  });
  const rows = res.data.sheets?.[0]?.data?.[0]?.rowData || [];
  let condition = null;
  for (const r of rows) {
    const c = r.values?.[0]?.dataValidation?.condition;
    if (c) { condition = c; break; }
  }
  if (!condition) return null;

  if (condition.type === 'ONE_OF_LIST') {
    return (condition.values || []).map((v) => v.userEnteredValue).filter(Boolean);
  }
  if (condition.type === 'ONE_OF_RANGE') {
    const ref = condition.values?.[0]?.userEnteredValue;
    if (!ref) return null;
    const vals = await sheets.spreadsheets.values.get({ spreadsheetId, range: ref.replace(/^=/, '') });
    return (vals.data.values || []).flat().map((x) => String(x).trim()).filter(Boolean);
  }
  return null;
}
