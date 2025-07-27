import type { Auth } from './server/auth'
import { clientEnv } from '$lib/env/client'
import { createSvelteAuth } from '@rttnd/gau/client/svelte'

export const auth = createSvelteAuth<Auth>({
  baseUrl: clientEnv.PUBLIC_API_URL,
  scheme: 'gau',
})
