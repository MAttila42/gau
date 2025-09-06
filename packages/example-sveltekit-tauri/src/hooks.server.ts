import { auth } from '$lib/server/auth'
import { SvelteKitAuth } from '@rttnd/gau/sveltekit'

export const { handle } = SvelteKitAuth(auth)
