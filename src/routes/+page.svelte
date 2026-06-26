<script>
  import { onMount, onDestroy } from 'svelte';
  import { api } from '$lib/client/api.js';
  import ReceiptCard from '$lib/components/ReceiptCard.svelte';
  import ReceiptReview from '$lib/components/ReceiptReview.svelte';

  let items = $state([]);
  let tabs = $state([]);
  let selectedId = $state(null);
  let dragOver = $state(false);
  let timer;

  const selected = $derived(items.find((i) => i.id === selectedId) ?? null);

  // Auto-select a receipt when nothing valid is selected (e.g. items that
  // arrived via the watched folder), so the review panel + buttons are visible.
  $effect(() => {
    if (!items.find((i) => i.id === selectedId) && items.length) {
      selectedId = (items.find((i) => i.status === 'ready') ?? items[0]).id;
    }
  });

  async function refresh() { items = await api.list(); }

  onMount(async () => {
    await refresh();
    try { tabs = await api.tabs(); } catch { tabs = []; }
    timer = setInterval(refresh, 2000);
  });
  onDestroy(() => clearInterval(timer));

  async function uploadFiles(files) {
    for (const f of files) {
      const item = await api.upload(f);
      selectedId = item.id;
    }
    await refresh();
  }

  function onPaste(e) {
    const files = [...(e.clipboardData?.files ?? [])];
    if (files.length) { e.preventDefault(); uploadFiles(files); }
  }
  function onDrop(e) {
    e.preventDefault(); dragOver = false;
    uploadFiles([...(e.dataTransfer?.files ?? [])]);
  }
</script>

<svelte:window on:paste={onPaste} />

<div
  class="dropzone" class:over={dragOver}
  role="button" tabindex="0"
  ondragover={(e) => { e.preventDefault(); dragOver = true; }}
  ondragleave={() => (dragOver = false)}
  ondrop={onDrop}
>
  Klistra in (Ctrl+V), släpp filer här, eller
  <input type="file" multiple accept="image/*,application/pdf"
    onchange={(e) => uploadFiles([...e.currentTarget.files])} />
  <a href="/settings">Inställningar</a>
</div>

<div class="grid">
  <div class="queue">
    {#each items as item (item.id)}
      <ReceiptCard {item} selected={item.id === selectedId} onselect={(id) => (selectedId = id)} />
    {/each}
    {#if items.length === 0}<p>Inga kvitton i kön ännu.</p>{/if}
  </div>
  <div>
    {#if selected && selected.status === 'ready'}
      <ReceiptReview item={selected} {tabs} onchange={refresh} />
    {:else if selected}
      <p>Status: {selected.status}{selected.error ? ` — ${selected.error}` : ''}</p>
    {:else}
      <p>Välj ett kvitto i kön.</p>
    {/if}
  </div>
</div>

<style>
  .dropzone { border: 2px dashed #cbd5e0; border-radius: 8px; padding: 16px; margin-bottom: 16px;
    display: flex; gap: 12px; align-items: center; flex-wrap: wrap; background: #fff; }
  .dropzone.over { border-color: #2b6cb0; background: #ebf8ff; }
  .grid { display: grid; grid-template-columns: 320px 1fr; gap: 16px; }
</style>
