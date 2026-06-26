const j = (r) => r.json();

export const api = {
  list: () => fetch('/api/receipts').then(j),
  get: (id) => fetch(`/api/receipts/${id}`).then(j),
  // The file goes as a raw body with its real content-type + filename header
  // (matches the server route; avoids multipart/CSRF).
  upload: (file) =>
    fetch('/api/receipts', {
      method: 'POST',
      headers: {
        'content-type': file.type || 'application/octet-stream',
        'x-filename': encodeURIComponent(file.name || 'pasted')
      },
      body: file
    }).then(j),
  patch: (id, patch) =>
    fetch(`/api/receipts/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) }).then(j),
  remove: (id) => fetch(`/api/receipts/${id}`, { method: 'DELETE' }).then(j),
  preview: (id) => fetch(`/api/receipts/${id}/preview`).then(j),
  commit: (id) => fetch(`/api/receipts/${id}/commit`, { method: 'POST' }).then(j),
  settings: () => fetch('/api/settings').then(j),
  saveSettings: (patch) =>
    fetch('/api/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(patch) }).then(j),
  tabs: () => fetch('/api/tabs').then(j)
};

export const CATEGORIES = ['Mat', 'Läsk/Snäx', 'Vård', 'Hem'];
