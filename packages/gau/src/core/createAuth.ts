import type { SerializeOptions } from 'cookie'
import type { SignOptions, VerifyOptions } from '../jwt'
import type { OAuthProvider } from '../oauth'
import type { Adapter, Session, User } from './index'
import { sign, verify } from '../jwt'
import { DEFAULT_COOKIE_SERIALIZE_OPTIONS } from './cookies'
import { AuthError } from './index'

type ProviderId<P> = P extends OAuthProvider<infer T> ? T : never
export type ProviderIds<T> = T extends { providerMap: Map<infer K, any> } ? K : string

export interface CreateAuthOptions<TProviders extends OAuthProvider[]> {
  /** The database adapter to use for storing users and accounts. */
  adapter: Adapter
  /** Array of OAuth providers to support. */
  providers: TProviders
  /** Base path for authentication routes (defaults to '/api/auth'). */
  basePath?: string
  /** Session management options */
  session?: {
    /** Strategy to use for sessions: 'auto' (default), 'cookie', or 'token'. */
    strategy?: 'auto' | 'cookie' | 'token'
  }
  /** Configuration for JWT signing and verification. */
  jwt?: {
    /** Signing algorithm: 'ES256' (default) or 'HS256'. */
    algorithm?: 'ES256' | 'HS256'
    /** Secret for HS256 or base64url-encoded private key for ES256 (overrides AUTH_SECRET). */
    secret?: string
    /** Issuer claim (iss) for JWTs. */
    iss?: string
    /** Audience claim (aud) for JWTs. */
    aud?: string
    /** Default time-to-live in seconds for JWTs (defaults to 1 day). */
    ttl?: number
  }
  /** Custom options for session cookies. */
  cookies?: Partial<SerializeOptions>
  /** Trusted hosts for CSRF protection: 'all' or array of hostnames (defaults to []). */
  trustHosts?: 'all' | string[]
  /** Account linking behavior: 'verifiedEmail' (default), 'always', or false. */
  autoLink?: 'verifiedEmail' | 'always' | false
}

export type Auth<TProviders extends OAuthProvider[] = any> = Adapter & {
  providerMap: Map<ProviderId<TProviders[number]>, TProviders[number]>
  basePath: string
  cookieOptions: SerializeOptions
  jwt: {
    ttl: number
  }
  signJWT: <U extends Record<string, unknown>>(payload: U, customOptions?: Partial<SignOptions>) => Promise<string>
  verifyJWT: <U = Record<string, unknown>>(token: string, customOptions?: Partial<VerifyOptions>) => Promise<U | null>
  createSession: (userId: string, data?: Record<string, unknown>, ttl?: number) => Promise<string>
  validateSession: (token: string) => Promise<{
    user: User
    session: Session
  } | null>
  trustHosts: 'all' | string[]
  autoLink: 'verifiedEmail' | 'always' | false
  sessionStrategy: 'auto' | 'cookie' | 'token'
}

export function createAuth<const TProviders extends OAuthProvider[]>({
  adapter,
  providers,
  basePath = '/api/auth',
  jwt: jwtConfig = {},
  session: sessionConfig = {},
  cookies: cookieConfig = {},
  trustHosts = [],
  autoLink = 'verifiedEmail',
}: CreateAuthOptions<TProviders>): Auth<TProviders> {
  const { algorithm = 'ES256', secret, iss, aud, ttl: defaultTTL = 3600 * 24 } = jwtConfig
  const cookieOptions = { ...DEFAULT_COOKIE_SERIALIZE_OPTIONS, ...cookieConfig }

  const sessionStrategy: 'auto' | 'cookie' | 'token' = sessionConfig.strategy ?? 'auto'

  if (algorithm === 'ES256' && secret !== undefined && typeof secret !== 'string')
    throw new AuthError('For ES256, the secret option must be a string.')

  const providerMap = new Map(providers.map(p => [p.id, p]))

  function buildSignOptions(custom: Partial<SignOptions> = {}): SignOptions {
    const base = { ttl: custom.ttl, iss: custom.iss ?? iss, aud: custom.aud ?? aud, sub: custom.sub }
    if (algorithm === 'HS256') {
      return { algorithm, secret: custom.secret ?? secret, ...base }
    }
    else {
      if (custom.secret !== undefined && typeof custom.secret !== 'string')
        throw new AuthError('For ES256, the secret option must be a string.')
      const esSecret = custom.secret ?? secret
      return { algorithm, privateKey: custom.privateKey, secret: esSecret, ...base }
    }
  }

  function buildVerifyOptions(custom: Partial<VerifyOptions> = {}): VerifyOptions {
    const base = { iss: custom.iss ?? iss, aud: custom.aud ?? aud }
    if (algorithm === 'HS256') {
      return { algorithm, secret: custom.secret ?? secret, ...base }
    }
    else {
      if (custom.secret !== undefined && typeof custom.secret !== 'string')
        throw new AuthError('For ES256, the secret option must be a string.')
      const esSecret = custom.secret ?? secret
      return { algorithm, publicKey: custom.publicKey, secret: esSecret, ...base }
    }
  }

  async function signJWT<U extends Record<string, unknown>>(payload: U, customOptions: Partial<SignOptions> = {}): Promise<string> {
    return sign(payload, buildSignOptions(customOptions))
  }

  async function verifyJWT<U = Record<string, unknown>>(token: string, customOptions: Partial<VerifyOptions> = {}): Promise<U | null> {
    const options = buildVerifyOptions(customOptions)
    try {
      return await verify<U>(token, options)
    }
    catch {
      return null
    }
  }

  async function createSession(userId: string, data: Record<string, unknown> = {}, ttl = defaultTTL): Promise<string> {
    const payload = { sub: userId, ...data }
    return signJWT(payload, { ttl })
  }

  async function validateSession(token: string): Promise<{ user: User, session: Session } | null> {
    const payload = await verifyJWT<{ sub: string } & Record<string, unknown>>(token)
    if (!payload)
      return null
    const user = await adapter.getUser(payload.sub)
    if (!user)
      return null
    return { user, session: { id: token, ...payload } }
  }

  return {
    ...adapter,
    providerMap: providerMap as Map<ProviderId<TProviders[number]>, TProviders[number]>,
    basePath,
    cookieOptions,
    jwt: {
      ttl: defaultTTL,
    },
    signJWT,
    verifyJWT,
    createSession,
    validateSession,
    trustHosts,
    autoLink,
    sessionStrategy,
  }
}
