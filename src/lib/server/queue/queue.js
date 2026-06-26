import { randomUUID } from 'node:crypto';

export function createQueue() {
  const items = new Map();
  return {
    add({ filename, mimetype, buffer, source }) {
      const id = randomUUID();
      const item = {
        id, filename, mimetype, buffer, source,
        status: 'pending', error: null, text: null, receipt: null, meta: null,
        createdAt: Date.now()
      };
      items.set(id, item);
      return item;
    },
    list() {
      return [...items.values()].sort((a, b) => a.createdAt - b.createdAt);
    },
    get(id) {
      return items.get(id) || null;
    },
    update(id, patch) {
      const it = items.get(id);
      if (!it) return null;
      Object.assign(it, patch);
      return it;
    },
    remove(id) {
      return items.delete(id);
    }
  };
}
