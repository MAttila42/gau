import * as rawEnv from '$env/static/private'
import { parseEnv, serverScheme } from './schema'

export const serverEnv = parseEnv(serverScheme, rawEnv, 'server')
