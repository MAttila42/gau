import type { AuthUser, OAuthProvider, OAuthProviderConfig } from '../index'
import { CodeChallengeMethod, OAuth2Client } from 'arctic'

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_API_URL = 'https://api.github.com'

interface GitHubUser {
  id: number
  login: string
  avatar_url: string
  name: string
  email: string | null
  [key: string]: unknown
}

interface GitHubEmail {
  email: string
  primary: boolean
  verified: boolean
  visibility: 'public' | 'private' | null
}

async function getUser(accessToken: string): Promise<AuthUser> {
  const response = await fetch(`${GITHUB_API_URL}/user`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'gau',
      'Accept': 'application/vnd.github+json',
    },
  })
  const data: GitHubUser = await response.json()

  let email: string | null = data.email
  let emailVerified = false

  const emailsResponse = await fetch(`${GITHUB_API_URL}/user/emails`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'User-Agent': 'gau',
      'Accept': 'application/vnd.github+json',
    },
  })

  if (emailsResponse.ok) {
    const emails: GitHubEmail[] = await emailsResponse.json()
    const primaryEmail = emails.find(e => e.primary && e.verified)
    if (primaryEmail) {
      email = primaryEmail.email
      emailVerified = true
    }
    else {
      // Fallback to the first verified email if no primary is found
      const verifiedEmail = emails.find(e => e.verified)
      if (verifiedEmail) {
        email = verifiedEmail.email
        emailVerified = true
      }
    }
  }

  return {
    id: data.id.toString(),
    name: data.name ?? data.login,
    email,
    emailVerified,
    avatar: data.avatar_url,
    raw: data,
  }
}

export function GitHub(config: OAuthProviderConfig): OAuthProvider<'github', OAuthProviderConfig> {
  const defaultClient = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri ?? null)

  function getClient(redirectUri?: string): OAuth2Client {
    if (!redirectUri || redirectUri === config.redirectUri)
      return defaultClient

    return new OAuth2Client(config.clientId, config.clientSecret, redirectUri)
  }

  return {
    id: 'github',
    linkOnly: config.linkOnly,
    requiresRedirectUri: true,

    async getAuthorizationUrl(state: string, codeVerifier: string, options?: { scopes?: string[], redirectUri?: string, params?: Record<string, string>, overrides?: any }) {
      const client = getClient(options?.redirectUri)
      const scopes = options?.scopes ?? config.scope ?? ['read:user', 'user:email']
      const url = await client.createAuthorizationURLWithPKCE(GITHUB_AUTH_URL, state, CodeChallengeMethod.S256, codeVerifier, scopes)
      if (options?.params) {
        for (const [k, v] of Object.entries(options.params)) {
          if (v != null)
            url.searchParams.set(k, String(v))
        }
      }
      return url
    },

    async validateCallback(code: string, codeVerifier: string, redirectUri?: string) {
      const client = getClient(redirectUri)
      const tokens = await client.validateAuthorizationCode(GITHUB_TOKEN_URL, code, codeVerifier)
      const user = await getUser(tokens.accessToken())
      return { tokens, user }
    },
  }
}
