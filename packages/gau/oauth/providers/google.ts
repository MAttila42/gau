import type { AuthUser, OAuthProvider, OAuthProviderConfig } from '../index'
import { CodeChallengeMethod, OAuth2Client } from 'arctic'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo'

interface GoogleUser {
  sub: string
  name: string
  email: string | null
  email_verified: boolean
  picture: string | null
  [key: string]: unknown
}

async function getUser(accessToken: string): Promise<AuthUser> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'gau',
    },
  })
  const data: GoogleUser = await response.json()

  return {
    id: data.sub,
    name: data.name,
    email: data.email,
    emailVerified: data.email_verified,
    avatar: data.picture,
    raw: data,
  }
}

export function Google(config: OAuthProviderConfig): OAuthProvider {
  const defaultClient = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri ?? null)

  function getClient(redirectUri?: string): OAuth2Client {
    if (!redirectUri || redirectUri === config.redirectUri)
      return defaultClient

    return new OAuth2Client(config.clientId, config.clientSecret, redirectUri)
  }

  return {
    id: 'google',
    requiresRedirectUri: true,

    async getAuthorizationUrl(state: string, codeVerifier: string, options?: { scopes?: string[], redirectUri?: string }) {
      const client = getClient(options?.redirectUri)
      const scopes = options?.scopes ?? config.scope ?? ['openid', 'email', 'profile']
      const url = await client.createAuthorizationURLWithPKCE(GOOGLE_AUTH_URL, state, CodeChallengeMethod.S256, codeVerifier, scopes)
      return url
    },

    async validateCallback(code: string, codeVerifier: string, redirectUri?: string) {
      const client = getClient(redirectUri)
      const tokens = await client.validateAuthorizationCode(GOOGLE_TOKEN_URL, code, codeVerifier)
      const user = await getUser(tokens.accessToken())
      return { tokens, user }
    },
  }
}
