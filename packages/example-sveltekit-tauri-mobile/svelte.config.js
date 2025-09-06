import process from 'node:process'
import Cloudflare from '@sveltejs/adapter-cloudflare'
import Static from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

const isTauri = !!process.env.TAURI_ENV_PLATFORM

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: isTauri
      ? Static({ fallback: 'index.html' })
      : Cloudflare(),
  },
}

export default config
