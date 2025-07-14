import type { OAuth2Tokens } from 'arctic'

export { GitHub } from './providers/github'
export { Google } from './providers/google'
export { MicrosoftEntraId } from './providers/microsoft'

export interface OAuthProviderConfig {
  clientId: string
  clientSecret: string
  redirectUri?: string
  scope?: string[]
}

export interface AuthUser {
  id: string
  name: string
  email: string | null
  emailVerified: boolean | null
  avatar: string | null
  raw: Record<string, unknown>
}

export interface OAuthProvider {
  id: string
  requiresRedirectUri?: boolean
  getAuthorizationUrl: (state: string, codeVerifier: string, options?: { scopes?: string[], redirectUri?: string }) => Promise<URL>
  validateCallback: (code: string, codeVerifier: string, redirectUri?: string) => Promise<{ tokens: OAuth2Tokens, user: AuthUser }>
}
