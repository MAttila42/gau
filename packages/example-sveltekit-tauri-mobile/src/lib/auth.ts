import type { Auth } from '$lib/server/auth'
import type { ProviderIds } from '@rttnd/gau'
import { useAuth as useAuthCore } from '@rttnd/gau/client/svelte'

export const useAuth = () => useAuthCore<Auth>()
export type Provider = ProviderIds<Auth>
