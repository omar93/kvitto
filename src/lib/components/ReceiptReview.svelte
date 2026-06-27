<script>
  import { CATEGORIES, api } from '$lib/client/api.js';
  let { item, tabs, onchange } = $props();

  // $state.snapshot unwraps Svelte's reactive proxy into a plain object
  // (structuredClone throws on the proxy).
  let receipt = $state($state.snapshot(item.receipt));
  let meta = $state($state.snapshot(item.meta));
  let preview = $state(null);
  let busy = $state(false);
  let message = $state('');

  // Only reload the editable copy when a *different* receipt is selected — not on
  // every poll refresh (which would wipe in-progress edits every 2s).
  let loadedId = item.id;
  $effect(() => {
    if (item.id !== loadedId) {
      loadedId = item.id;
      receipt = $state.snapshot(item.receipt);
      meta = $state.snapshot(item.meta);
      preview = null;
      message = '';
    }
  });

  async function save() {
    busy = true;
    await api.patch(item.id, { receipt, meta });
    busy = false;
    onchange?.();
  }
  async function doPreview() {
    await save();
    busy = true;
    const r = await api.preview(item.id);
    preview = r.error ? null : r.plan;
    message = r.error ? `Förhandsvisning misslyckades: ${r.error}` : '';
    busy = false;
  }
  async function doCommit() {
    await save();
    busy = true;
    const r = await api.commit(item.id);
    message = r.error ? `Commit misslyckades: ${r.error}` : `Skrev ${r.plan?.valueRange?.range ?? ''}`;
    busy = false;
    onchange?.();
  }
</script>

{#if receipt}
  <div class="review">
    <div class="row">
      <label>Butik <input bind:value={receipt.store} /></label>
      <label>Datum <input bind:value={receipt.date} /></label>
    </div>
    <div class="row">
      <label>Plats (M) <input bind:value={meta.location} /></label>
      <label>Köpt med (N) <input bind:value={meta.card} /></label>
      <label>Flik
        <select bind:value={meta.tab}>
          {#if !tabs?.some((t) => t.title === meta.tab)}<option value={meta.tab}>{meta.tab} (skapas)</option>{/if}
          {#each tabs ?? [] as t}<option value={t.title}>{t.title}</option>{/each}
        </select>
      </label>
    </div>

    <table>
      <thead><tr><th>Vara</th><th>Pris</th><th>Pant</th><th>Kategori</th></tr></thead>
      <tbody>
        {#each receipt.items as line}
          <tr>
            <td><input bind:value={line.name} /></td>
            <td><input type="number" step="0.01" bind:value={line.price} /></td>
            <td><input type="number" step="0.01" bind:value={line.deposit} /></td>
            <td>
              <select bind:value={line.category}>
                <option value={null}>—</option>
                {#each CATEGORIES as c}<option value={c}>{c}</option>{/each}
              </select>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    <div class="actions">
      <button onclick={save} disabled={busy}>Spara</button>
      <button onclick={doPreview} disabled={busy}>Förhandsgranska (dry-run)</button>
      <button onclick={doCommit} disabled={busy || item.status === 'committed'}>Skriv till Sheet</button>
    </div>

    {#if message}<p class="msg">{message}</p>{/if}
    {#if preview}
      <h4>Skulle skriva {preview.valueRange.range}</h4>
      <table>
        <tbody>
          {#each preview.valueRange.values as r}
            <tr>{#each r as c}<td>{c}</td>{/each}</tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
{/if}

<style>
  .review { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
  .row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
  label { display: flex; flex-direction: column; font-size: 12px; color: #555; gap: 2px; }
  input, select { padding: 4px 6px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  td, th { border: 1px solid #eee; padding: 4px; text-align: left; }
  .actions { display: flex; gap: 8px; margin-top: 8px; }
  .msg { color: #2b6cb0; }
</style>
