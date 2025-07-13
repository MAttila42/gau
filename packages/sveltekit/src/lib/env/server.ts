import process from 'node:process'
import { z } from 'zod'
import { serverScheme } from './schema'

const env = serverScheme.safeParse(process.env)

if (env.success === false) {
  console.error(z.prettifyError(env.error))
  throw new Error('Invalid server environment variables')
}

export const serverEnv = env.data
