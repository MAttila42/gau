import { serverEnv } from '$lib/env/server'
import { DrizzleAdapter } from '@yuo-app/gau/adapters/drizzle'
import { GitHub, Google, MicrosoftEntraId } from '@yuo-app/gau/oauth'
import { SvelteKitAuth } from '@yuo-app/gau/sveltekit'
import { db } from './db'
import { Accounts, Users } from './db/schema'

export const { GET, POST, OPTIONS, handle } = SvelteKitAuth({
  adapter: DrizzleAdapter(db, Users, Accounts),
  providers: [
    GitHub({
      clientId: serverEnv.AUTH_GITHUB_ID,
      clientSecret: serverEnv.AUTH_GITHUB_SECRET,
    }),
    Google({
      clientId: serverEnv.AUTH_GOOGLE_ID,
      clientSecret: serverEnv.AUTH_GOOGLE_SECRET,
    }),
    MicrosoftEntraId({
      clientId: serverEnv.AUTH_MICROSOFT_ID,
      clientSecret: serverEnv.AUTH_MICROSOFT_SECRET,
    }),
  ],
  jwt: {
    secret: serverEnv.AUTH_SECRET,
  },
  trustHosts: 'all',
})
