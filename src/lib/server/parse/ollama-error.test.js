import { describe, it, expect } from 'vitest';
import { ollamaError } from './ollama-error.js';

describe('ollamaError', () => {
  it('extracts the error field from a JSON body', async () => {
    const res = { status: 500, text: async () => JSON.stringify({ error: "unknown model architecture: 'mllama'" }) };
    expect(await ollamaError(res)).toBe("Ollama HTTP 500: unknown model architecture: 'mllama'");
  });

  it('falls back to the raw body', async () => {
    const res = { status: 404, text: async () => 'not found' };
    expect(await ollamaError(res)).toBe('Ollama HTTP 404: not found');
  });
});
