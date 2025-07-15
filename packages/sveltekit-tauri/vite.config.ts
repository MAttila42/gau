import process from 'node:process'
import { sveltekit } from '@sveltejs/kit/vite'
import UnoCSS from 'unocss/vite'
import { defineConfig } from 'vite'

const isTauri = !!process.env.TAURI_ENV_PLATFORM

export default defineConfig({
  plugins: [sveltekit(), UnoCSS()],
  server: {
    port: isTauri ? 4173 : 5173,
    strictPort: true,
  },
})
