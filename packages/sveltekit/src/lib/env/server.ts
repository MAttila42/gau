import * as rawEnv from '$env/static/private'
import { z } from 'zod'

import { serverScheme } from './schema'

const env = serverScheme.safeParse(rawEnv)

if (env.success === false) {
  console.error(z.prettifyError(env.error))
  throw new Error('Invalid server environment variables')
}

export const serverEnv = env.data
