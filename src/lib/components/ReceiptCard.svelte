<script>
  let { item, selected, onselect } = $props();
  const badge = { pending: '⏳', ready: '✅', error: '⚠️', committed: '💾' };
</script>

<button class="card" class:selected onclick={() => onselect(item.id)}>
  <span>{badge[item.status] ?? ''}</span>
  <strong>{item.receipt?.store ?? item.filename}</strong>
  <small>{item.status}{item.error ? `: ${item.error}` : ''}</small>
</button>

<style>
  .card { display: flex; gap: 8px; align-items: center; width: 100%; text-align: left;
    padding: 8px; border: 1px solid #ddd; border-radius: 8px; background: #fff; margin-bottom: 6px; }
  .card.selected { border-color: #2b6cb0; box-shadow: 0 0 0 2px #bee3f8; }
  small { color: #666; margin-left: auto; }
</style>
