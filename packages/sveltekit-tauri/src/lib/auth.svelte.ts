import { clientEnv } from '$lib/env/client'
import { createSvelteAuth } from '@rttnd/gau/client/svelte'

export const auth = createSvelteAuth({
  baseUrl: clientEnv.PUBLIC_API_URL,
})
