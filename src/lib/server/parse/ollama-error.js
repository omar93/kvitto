/** Build a helpful error message from a failed Ollama response (includes its body). */
export async function ollamaError(res) {
  let detail = '';
  try {
    const body = await res.text();
    try {
      detail = JSON.parse(body).error || body;
    } catch {
      detail = body;
    }
  } catch {
    /* ignore */
  }
  detail = String(detail).replace(/\s+/g, ' ').trim().slice(0, 300);
  return `Ollama HTTP ${res.status}${detail ? `: ${detail}` : ''}`;
}
