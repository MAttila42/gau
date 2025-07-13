import { z } from 'zod'
import { clientScheme } from './schema'

const env = clientScheme.safeParse(import.meta.env)

if (env.success === false) {
  console.error(z.prettifyError(env.error))
  throw new Error('Invalid client environment variables')
}

export const clientEnv = env.data
