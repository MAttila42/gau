/* eslint-disable no-console */
/* eslint-disable antfu/no-top-level-await */
import process from 'node:process'
import { $, Glob } from 'bun'

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

const glob = new Glob('packages/gau/**/index.{ts,tsx}')

const result = await Bun.build({
  entrypoints: await Array.fromAsync(glob.scan()),
  outdir: './packages/gau/dist',
  root: './packages/gau',
  target: 'browser',
  splitting: true,
  packages: 'external',
  sourcemap: 'external',
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
