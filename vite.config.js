import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Note: vitest uses vitest.config.js (which takes precedence), so the SvelteKit
// plugin here never loads during `npm test`.
export default defineConfig({
  plugins: [sveltekit()]
});
