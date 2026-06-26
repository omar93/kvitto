import { describe, it, expect, vi } from 'vitest';
import { createSheetsClient } from './client.js';

describe('createSheetsClient', () => {
  it('throws when no credentials are supplied', () => {
    expect(() => createSheetsClient({})).toThrow(/credentials/i);
  });

  it('builds a sheets client with spreadsheets scope from a key file', () => {
    const sheetsObj = { spreadsheets: {} };
    const googleImpl = {
      auth: { GoogleAuth: vi.fn().mockImplementation((cfg) => ({ cfg })) },
      sheets: vi.fn().mockReturnValue(sheetsObj)
    };
    const client = createSheetsClient({ keyFile: '/k.json', googleImpl });
    expect(googleImpl.auth.GoogleAuth).toHaveBeenCalledWith({
      keyFile: '/k.json',
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    expect(googleImpl.sheets).toHaveBeenCalledWith(expect.objectContaining({ version: 'v4' }));
    expect(client).toBe(sheetsObj);
  });
});
