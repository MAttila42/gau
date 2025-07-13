/* eslint-disable antfu/no-top-level-await */
import { $, Glob } from 'bun'

const tscMain = $`bunx tsc --project packages/gau/tsconfig.json --watch --preserveWatchOutput`
const tscSolid = $`bunx tsc --project packages/gau/client/solid/tsconfig.json --watch --preserveWatchOutput`
const tscSvelte = $`bunx tsc --project packages/gau/client/svelte/tsconfig.json --watch --preserveWatchOutput`

const glob = new Glob('packages/gau/**/index.{ts,tsx,svelte.ts}')
const entrypoints = (await Array.fromAsync(glob.scan())) as string[]

const bunBuild = $`bun build ${entrypoints} --outdir ./packages/gau/dist --splitting --target node --sourcemap=external --watch`

await Promise.all([
  tscMain,
  tscSolid,
  tscSvelte,
  bunBuild,
])
