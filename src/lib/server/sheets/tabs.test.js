import { describe, it, expect, vi } from 'vitest';
import { listTabs, resolveTab } from './tabs.js';

function fakeSheets(tabs) {
  const state = tabs.map((t) => ({ properties: t }));
  return {
    _state: state,
    spreadsheets: {
      get: vi.fn().mockImplementation(async () => ({ data: { sheets: state } })),
      batchUpdate: vi.fn().mockImplementation(async ({ requestBody }) => {
        const req = requestBody.requests[0].duplicateSheet;
        state.push({ properties: { title: req.newSheetName, sheetId: 999 } });
        return { data: {} };
      })
    }
  };
}

describe('listTabs', () => {
  it('returns titles and ids', async () => {
    const s = fakeSheets([{ title: 'TEMPLATE', sheetId: 1 }, { title: '2026-06/07', sheetId: 2 }]);
    expect(await listTabs(s, 'SID')).toEqual([
      { title: 'TEMPLATE', sheetId: 1 },
      { title: '2026-06/07', sheetId: 2 }
    ]);
  });
});

describe('resolveTab', () => {
  it('returns an existing tab without creating', async () => {
    const s = fakeSheets([{ title: '2026-06/07', sheetId: 2 }]);
    const r = await resolveTab(s, 'SID', '2026-06/07', { templateTab: 'TEMPLATE', create: true });
    expect(r).toEqual({ title: '2026-06/07', sheetId: 2, created: false });
    expect(s.spreadsheets.batchUpdate).not.toHaveBeenCalled();
  });

  it('creates from the template when missing and create=true', async () => {
    const s = fakeSheets([{ title: 'TEMPLATE', sheetId: 1 }]);
    const r = await resolveTab(s, 'SID', '2026-06/07', { templateTab: 'TEMPLATE', create: true });
    expect(r).toEqual({ title: '2026-06/07', sheetId: 999, created: true });
    const body = s.spreadsheets.batchUpdate.mock.calls[0][0].requestBody;
    expect(body.requests[0].duplicateSheet).toMatchObject({ sourceSheetId: 1, newSheetName: '2026-06/07' });
  });

  it('throws when missing and create=false', async () => {
    const s = fakeSheets([{ title: 'TEMPLATE', sheetId: 1 }]);
    await expect(resolveTab(s, 'SID', '2026-06/07', { create: false })).rejects.toThrow(/does not exist/i);
  });

  it('throws when template is missing', async () => {
    const s = fakeSheets([]);
    await expect(resolveTab(s, 'SID', '2026-06/07', { templateTab: 'TEMPLATE', create: true }))
      .rejects.toThrow(/template/i);
  });
});
