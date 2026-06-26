import { createService } from './service.js';

export const service = createService({
  settingsPath: 'data/settings.json',
  spreadsheetId: process.env.KVITTO_SPREADSHEET_ID || '',
  templateTab: process.env.KVITTO_TEMPLATE_TAB || 'Mall',
  keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS || 'credentials.json'
});
