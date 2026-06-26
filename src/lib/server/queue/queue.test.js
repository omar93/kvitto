import { describe, it, expect } from 'vitest';
import { createQueue } from './queue.js';

describe('createQueue', () => {
  it('adds items with an id and pending status', () => {
    const q = createQueue();
    const item = q.add({ filename: 'a.png', mimetype: 'image/png', buffer: Buffer.from('x'), source: 'upload' });
    expect(item.id).toBeTruthy();
    expect(item.status).toBe('pending');
    expect(q.get(item.id)).toBe(item);
  });

  it('lists items oldest-first and updates and removes', () => {
    const q = createQueue();
    const a = q.add({ filename: 'a', mimetype: 'image/png', buffer: Buffer.from('1'), source: 'upload' });
    const b = q.add({ filename: 'b', mimetype: 'image/png', buffer: Buffer.from('2'), source: 'upload' });
    expect(q.list().map((i) => i.id)).toEqual([a.id, b.id]);
    const updated = q.update(a.id, { status: 'ready' });
    expect(updated.status).toBe('ready');
    expect(q.remove(a.id)).toBe(true);
    expect(q.get(a.id)).toBeNull();
  });

  it('returns null when updating or getting an unknown id', () => {
    const q = createQueue();
    expect(q.get('nope')).toBeNull();
    expect(q.update('nope', { status: 'ready' })).toBeNull();
  });
});
