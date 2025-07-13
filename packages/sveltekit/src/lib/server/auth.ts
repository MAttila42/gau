import { serverEnv } from '$lib/env/server'
import { DrizzleAdapter } from '@yuo-app/gau/adapters/drizzle'
import { GitHub } from '@yuo-app/gau/oauth'
import { SvelteKitAuth } from '@yuo-app/gau/sveltekit'
import { db } from './db'
import { Accounts, Users } from './db/schema'

console.log('SECRET', serverEnv.AUTH_SECRET)

export const { GET, POST, handle } = SvelteKitAuth({
  adapter: DrizzleAdapter(db, Users, Accounts),
  providers: [
    GitHub({
      clientId: serverEnv.AUTH_GITHUB_ID,
      clientSecret: serverEnv.AUTH_GITHUB_SECRET,
    }),
  ],
  jwt: {
    secret: serverEnv.AUTH_SECRET,
  },
})
