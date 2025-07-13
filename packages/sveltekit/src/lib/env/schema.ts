import { z } from 'zod'

export const serverScheme = z.object({
  AUTH_GITHUB_ID: z.string(),
  AUTH_GITHUB_SECRET: z.string(),
  AUTH_SECRET: z.string(),
  AUTH_URL: z.string(),
  TURSO_DB_URL: z.string(),
  TURSO_AUTH_TOKEN: z.string(),
})

export const clientScheme = z.object({
  VITE_API_URL: z.string(),
})
