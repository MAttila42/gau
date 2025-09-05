import type { OAuth2Tokens } from 'arctic'

export { GitHub } from './providers/github'
export { Google } from './providers/google'
export { Microsoft } from './providers/microsoft'

export interface OAuthProviderConfig {
  clientId: string
  clientSecret: string
  redirectUri?: string
  scope?: string[]
}

export interface RefreshedTokens {
  accessToken: string
  refreshToken?: string | null
  expiresAt?: number | null
  idToken?: string | null
  tokenType?: string | null
  scope?: string | null
}

export interface AuthUser {
  id: string
  name: string
  email: string | null
  emailVerified: boolean | null
  avatar: string | null
  raw: Record<string, unknown>
}

export interface OAuthProvider<T extends string = string> {
  id: T
  requiresRedirectUri?: boolean
  getAuthorizationUrl: (state: string, codeVerifier: string, options?: { scopes?: string[], redirectUri?: string }) => Promise<URL>
  validateCallback: (code: string, codeVerifier: string, redirectUri?: string) => Promise<{ tokens: OAuth2Tokens, user: AuthUser }>
  refreshAccessToken?: (refreshToken: string, options?: { redirectUri?: string, scopes?: string[] }) => Promise<RefreshedTokens>
}
