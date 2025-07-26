<h1 align="center">gau</h1>
<p align="center">
  /ɡɔː/ <br>
  <strong>good auth</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@rttnd/gau"><img src="https://img.shields.io/npm/v/%40rttnd%2Fgau?color=red" alt="NPM Version"></a>
  <a href="https://jsr.io/@rttnd/gau"><img src="https://img.shields.io/jsr/v/%40rttnd/gau?color=yellow" alt="JSR Version"></a>
</p>

**Read the docs**: [gau.rettend.me](https://gau.rettend.me)

- **Flexible** - Small and self-hostable, works with backend-only, full-stack, and native apps, and on different hosts
- **Framework agnostic** - Core is framework-free and uses Web Crypto, with helpers for frameworks and runtimes
- **Runtime agnostic** - Runs on Bun, Node, Deno, Cloudflare Workers, and even Tauri
- **Database agnostic** - Can support any database via adapters

## examples

Check out the [`packages`](https://github.com/Rettend/gau/tree/main/packages) folder in this repo for complete working apps:

- `sveltekit`: SvelteKit + Turso
- `sveltekit-tauri`: SvelteKit + Turso + Tauri (desktop)
- `sveltekit-mobile`: SvelteKit + Turso + Tauri (mobile and desktop)
- `solidstart`: SolidStart + Turso

## contributing

`gau` is everything-agnostic, but it's missing a ton of integrations.
If you want to add a new...

- OAuth provider
- Database adapter
- Framework integration
- Platform integration

... PRs are welcome!

## license

MIT
