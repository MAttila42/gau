import { defineConfig } from 'drizzle-kit'
import { serverEnv } from './src/lib/env/server'

export default defineConfig({
  schema: './src/lib/server/db/schema.ts',
  dialect: 'turso',
  dbCredentials: {
    authToken: serverEnv.TURSO_AUTH_TOKEN,
    url: serverEnv.TURSO_DB_URL,
  },
  verbose: true,
  strict: true,
})
