export async function listTabs(sheets, spreadsheetId) {
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return (res.data.sheets || []).map((s) => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId
  }));
}

/** Returns the tab if it exists, else null. Never creates anything. */
export async function findTab(sheets, spreadsheetId, tabName) {
  const tabs = await listTabs(sheets, spreadsheetId);
  return tabs.find((t) => t.title === tabName) || null;
}

/**
 * @returns {Promise<{ title: string, sheetId: number, created: boolean }>}
 */
export async function resolveTab(sheets, spreadsheetId, tabName, { templateTab, create = false } = {}) {
  const tabs = await listTabs(sheets, spreadsheetId);
  const existing = tabs.find((t) => t.title === tabName);
  if (existing) return { ...existing, created: false };

  if (!create) throw new Error(`Tab "${tabName}" does not exist`);

  const template = tabs.find((t) => t.title === templateTab);
  if (!template) throw new Error(`Template tab "${templateTab}" not found; cannot create "${tabName}"`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [{ duplicateSheet: { sourceSheetId: template.sheetId, newSheetName: tabName } }]
    }
  });

  const after = await listTabs(sheets, spreadsheetId);
  const created = after.find((t) => t.title === tabName);
  return { ...created, created: true };
}
