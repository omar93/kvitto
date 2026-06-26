import { describe, it, expect, vi } from 'vitest';
import { extractImageText } from './ocr.js';

describe('extractImageText', () => {
  it('runs a worker, returns trimmed text, and terminates the worker', async () => {
    const terminate = vi.fn();
    const recognize = vi.fn().mockResolvedValue({ data: { text: '  Maxi Banan 24,18\n' } });
    const fakeCreateWorker = vi.fn().mockResolvedValue({ recognize, terminate });

    const text = await extractImageText(Buffer.from('img'), {
      lang: 'swe+eng',
      createWorker: fakeCreateWorker
    });

    expect(fakeCreateWorker).toHaveBeenCalledWith('swe+eng');
    expect(recognize).toHaveBeenCalledOnce();
    expect(terminate).toHaveBeenCalledOnce();
    expect(text).toBe('Maxi Banan 24,18');
  });
});
