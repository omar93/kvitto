import { google as defaultGoogle } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

/**
 * @param {{ keyFile?: string, credentials?: object, googleImpl?: any }} opts
 * @returns {any} sheets v4 client
 */
export function createSheetsClient({ keyFile, credentials, googleImpl } = {}) {
  if (!keyFile && !credentials) {
    throw new Error('createSheetsClient: provide keyFile or credentials (service account)');
  }
  const google = googleImpl || defaultGoogle;
  const auth = new google.auth.GoogleAuth(
    keyFile ? { keyFile, scopes: SCOPES } : { credentials, scopes: SCOPES }
  );
  return google.sheets({ version: 'v4', auth });
}
