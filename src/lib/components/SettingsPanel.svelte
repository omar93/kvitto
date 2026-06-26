<script>
  import { onMount } from 'svelte';
  import { api } from '$lib/client/api.js';

  let s = $state(null);
  let saved = $state(false);

  onMount(async () => { s = await api.settings(); });

  async function save() {
    s = await api.saveSettings(s);
    saved = true;
    setTimeout(() => (saved = false), 1500);
  }
</script>

{#if s}
  <div class="panel">
    <h3>Bekräftelser (stäng av för express-läge)</h3>
    {#each Object.keys(s.confirmations) as key}
      <label><input type="checkbox" bind:checked={s.confirmations[key]} /> {key}</label>
    {/each}

    <h3>Senast använt</h3>
    <label>Plats <input bind:value={s.lastUsed.location} /></label>
    <label>Köpt med <input bind:value={s.lastUsed.card} /></label>

    <h3>Sheet</h3>
    <label>Spreadsheet-ID <input bind:value={s.sheet.spreadsheetId} /></label>
    <label>Mall-flik <input bind:value={s.sheet.templateTab} /></label>

    <h3>Ollama</h3>
    <label>Host <input bind:value={s.ollama.host} /></label>
    <label>Modell <input bind:value={s.ollama.model} /></label>

    <h3>Bevakad mapp</h3>
    <label>Sökväg <input bind:value={s.watchFolder} placeholder="t.ex. C:\\Users\\omar\\kvitton" /></label>

    <div class="actions">
      <button onclick={save}>Spara</button>
      {#if saved}<span class="ok">Sparat ✓</span>{/if}
      <a href="/">Tillbaka</a>
    </div>
  </div>
{/if}

<style>
  .panel { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 12px; max-width: 560px; }
  label { display: flex; gap: 8px; align-items: center; margin: 4px 0; }
  input[type='text'], input:not([type]) { flex: 1; padding: 4px 6px; }
  h3 { margin: 14px 0 6px; }
  .actions { margin-top: 12px; display: flex; gap: 12px; align-items: center; }
  .ok { color: green; }
</style>
