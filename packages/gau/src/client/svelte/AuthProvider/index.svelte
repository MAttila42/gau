<script lang='ts'>
  import type { Snippet } from 'svelte'
  import { createSvelteAuth } from '../index.svelte'

  type Props = {
    baseUrl?: string
    scheme?: string
    redirectTo?: string
    children: Snippet
  }

  const { baseUrl, scheme, redirectTo, children }: Props = $props()

  createSvelteAuth({ baseUrl, scheme, redirectTo })
</script>

{@render children()}
