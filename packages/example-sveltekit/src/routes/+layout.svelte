<script lang='ts'>
  import { clientEnv } from '$lib/env/client'
  import AuthProvider from '@rttnd/gau/client/svelte/AuthProvider.svelte'
  import '@unocss/reset/tailwind.css'
  import 'virtual:uno.css'

  const { children } = $props()
</script>

<AuthProvider baseUrl={clientEnv.PUBLIC_API_URL}>
  {@render children()}
</AuthProvider>
