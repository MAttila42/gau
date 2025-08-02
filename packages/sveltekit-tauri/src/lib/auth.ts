import type { Auth as ServerAuth } from '$lib/server/auth'
import { useAuth as useGauAuth } from '@rttnd/gau/client/svelte'

export const useAuth = () => useGauAuth<ServerAuth>()
