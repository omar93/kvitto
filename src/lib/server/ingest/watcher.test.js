import { describe, it, expect, vi } from 'vitest';
import { mimeFromName, handleNewFile } from './watcher.js';

describe('mimeFromName', () => {
  it('maps known receipt extensions', () => {
    expect(mimeFromName('a.PDF')).toBe('application/pdf');
    expect(mimeFromName('a.png')).toBe('image/png');
    expect(mimeFromName('a.jpeg')).toBe('image/jpeg');
    expect(mimeFromName('a.txt')).toBeNull();
  });
});

describe('handleNewFile', () => {
  it('reads and ingests a supported file', async () => {
    const ingest = vi.fn().mockResolvedValue({});
    const readFile = vi.fn().mockResolvedValue(Buffer.from('data'));
    await handleNewFile('/dir/kvitto.png', { readFile, ingest });
    expect(ingest).toHaveBeenCalledWith({
      buffer: Buffer.from('data'), filename: 'kvitto.png', mimetype: 'image/png', source: 'folder'
    });
  });

  it('ignores unsupported files', async () => {
    const ingest = vi.fn();
    const readFile = vi.fn();
    await handleNewFile('/dir/notes.txt', { readFile, ingest });
    expect(readFile).not.toHaveBeenCalled();
    expect(ingest).not.toHaveBeenCalled();
  });
});
