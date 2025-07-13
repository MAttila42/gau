/* eslint-disable no-console */
/* eslint-disable antfu/no-top-level-await */
import process from 'node:process'
import { $ } from 'bun'

console.log('Cleaning dist directory...')
await $`rm -rf packages/gau/dist`.quiet()

console.log('Generating .d.ts files...')

const tscResult = await $`bunx tsc --project packages/gau/tsconfig.json`.quiet()
if (tscResult.exitCode !== 0) {
  console.error('Failed to generate .d.ts files for main package.')
  console.error(tscResult.stderr.toString())
  process.exit(1)
}

const tscSolidResult = await $`bunx tsc --project packages/gau/client/solid/tsconfig.json`.quiet()
if (tscSolidResult.exitCode !== 0) {
  console.error('Failed to generate .d.ts files for Solid client.')
  console.error(tscSolidResult.stderr.toString())
  process.exit(1)
}

console.log('Successfully generated .d.ts files.')

console.log('Bundling .mjs files...')
const result = await Bun.build({
  entrypoints: [
    './packages/gau/index.ts',
    './packages/gau/adapters/drizzle/index.ts',
    './packages/gau/adapters/memory/index.ts',
    './packages/gau/cli/index.ts',
    './packages/gau/client/solid/index.tsx',
    './packages/gau/client/svelte/index.ts',
    './packages/gau/core/index.ts',
    './packages/gau/jwt/index.ts',
    './packages/gau/oauth/index.ts',
    './packages/gau/runtimes/bun/index.ts',
    './packages/gau/runtimes/cloudflare/index.ts',
    './packages/gau/runtimes/tauri/index.ts',
    './packages/gau/solidstart/index.ts',
  ],
  outdir: './packages/gau/dist',
  root: './packages/gau',
  target: 'browser',
  splitting: true,
  packages: 'external',
  naming: {
    entry: '[dir]/[name].mjs',
    chunk: '[name]-[hash].mjs',
  },
})

if (!result.success) {
  console.error('Build failed.')
  for (const message of result.logs)
    console.error(message)

  process.exit(1)
}

console.log('Build successful!')
