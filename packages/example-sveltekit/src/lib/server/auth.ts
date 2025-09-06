import * as env from '$env/static/private'
import { createAuth } from '@rttnd/gau'
import { DrizzleAdapter } from '@rttnd/gau/adapters/drizzle'
import { GitHub, Google, Microsoft } from '@rttnd/gau/oauth'
import { db } from './db'
import { Accounts, Users } from './db/schema'

export const auth = createAuth({
  adapter: DrizzleAdapter(db, Users, Accounts),
  providers: [
    GitHub({
      clientId: env.AUTH_GITHUB_ID,
      clientSecret: env.AUTH_GITHUB_SECRET,
    }),
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
    Microsoft({
      clientId: env.AUTH_MICROSOFT_ID,
      clientSecret: env.AUTH_MICROSOFT_SECRET,
    }),
  ],
  jwt: {
    secret: env.AUTH_SECRET,
  },
  trustHosts: 'all',
})

export type Auth = typeof auth
