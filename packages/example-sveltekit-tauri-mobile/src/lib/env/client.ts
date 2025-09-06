import * as rawEnv from '$env/static/public'
import { clientScheme, parseEnv } from './schema'

export const clientEnv = parseEnv(clientScheme, rawEnv, 'client')
