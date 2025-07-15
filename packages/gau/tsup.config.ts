/* eslint-disable no-console */
import type { Options } from 'tsup'
import { $, Glob } from 'bun'
import { defineConfig } from 'tsup'

const commonConfig = {
  format: ['esm'],
  target: 'node20',
  splitting: true,
  sourcemap: true,
  dts: false,
  minify: true,
  clean: true,
  outDir: 'dist',
} satisfies Options

function toEntryObject(paths: string[]) {
  return paths.reduce<Record<string, string>>((acc, path) => {
    const entryName = path.replace(/\.(ts|tsx|svelte\.ts)$/, '')
    acc[entryName] = path
    return acc
  }, {})
}

export default defineConfig(async () => {
  const glob = new Glob('**/index.{ts,tsx,svelte.ts}')
  const allEntries = await Array.fromAsync(glob.scan('.'))

  const solidEntry = allEntries.find(e => /client[\\/]solid[\\/]index\.(?:ts|tsx)$/.test(e))!
  const svelteEntry = allEntries.find(e => /client[\\/]svelte[\\/]index\.svelte\.ts$/.test(e))!

  const otherEntries = allEntries.filter(e => e !== solidEntry && e !== svelteEntry)

  return [
    {
      ...commonConfig,
      entry: toEntryObject(otherEntries),
      async onSuccess() {
        console.log('⚡️ Generating .d.ts files with tsgo...')
        await Promise.all([
          $`bun tsgo --project tsconfig.json`,
          $`bun tsgo --project client/solid/tsconfig.json`,
          $`bun tsgo --project client/svelte/tsconfig.json`,
        ])
        console.log('✅ Successfully generated .d.ts files.')
      },
    },
    {
      ...commonConfig,
      entry: toEntryObject([solidEntry]),
      tsconfig: 'client/solid/tsconfig.json',
    },
    {
      ...commonConfig,
      splitting: false,
      entry: toEntryObject([svelteEntry]),
      tsconfig: 'client/svelte/tsconfig.json',
      outExtension() {
        return { js: '.svelte.js' }
      },
    },
  ]
})
