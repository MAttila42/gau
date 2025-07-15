/* eslint-disable no-console */
import { $, Glob } from 'bun'

console.log('Cleaning dist directory...')
await $`rm -rf packages/gau/dist`.quiet()

const tscMain = $`bunx tsc --project packages/gau/tsconfig.json --watch --preserveWatchOutput`
const tscSolid = $`bunx tsc --project packages/gau/client/solid/tsconfig.json --watch --preserveWatchOutput`
const tscSvelte = $`bunx tsc --project packages/gau/client/svelte/tsconfig.json --watch --preserveWatchOutput`

const glob = new Glob('packages/gau/**/index.{ts,tsx,svelte.ts}')
const entrypoints = (await Array.fromAsync(glob.scan())) as string[]

const bunBuild = $`bun build ${entrypoints} --outdir ./packages/gau/dist --root ./packages/gau --splitting --target browser --packages external --sourcemap=external --entry-naming "[dir]/[name].js" --chunk-naming "[name]-[hash].js" --watch`

await Promise.all([
  tscMain,
  tscSolid,
  tscSvelte,
  bunBuild,
])
