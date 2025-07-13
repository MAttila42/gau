import type { AuthUser, OAuthProvider, OAuthProviderConfig } from '../index'
import { CodeChallengeMethod, OAuth2Client } from 'arctic'

// https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc
const MICROSOFT_USER_INFO_URL = 'https://graph.microsoft.com/v1.0/me'

// https://learn.microsoft.com/en-us/graph/api/profilephoto-get?view=graph-rest-1.0
const MICROSOFT_USER_PHOTO_URL = 'https://graph.microsoft.com/v1.0/me/photo/$value'

interface MicrosoftEntraIdConfig extends OAuthProviderConfig {
  tenant?: 'common' | 'organizations' | 'consumers' | string
}

interface MicrosoftUser {
  id: string
  displayName: string
  mail: string | null
  userPrincipalName: string
  [key: string]: unknown
}

async function getUser(accessToken: string): Promise<AuthUser> {
  const userResponse = await fetch(MICROSOFT_USER_INFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const userData: MicrosoftUser = await userResponse.json()

  const photoResponse = await fetch(MICROSOFT_USER_PHOTO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  let avatar: string | null = null
  if (photoResponse.ok) {
    try {
      const blob = await photoResponse.blob()
      const reader = new FileReader()
      const dataUrlPromise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      avatar = await dataUrlPromise
    }
    catch {
    }
  }

  return {
    id: userData.id,
    name: userData.displayName,
    email: userData.mail ?? userData.userPrincipalName,
    avatar,
    raw: userData,
  }
}

export function MicrosoftEntraId(config: MicrosoftEntraIdConfig): OAuthProvider {
  const tenant = config.tenant ?? 'common'

  const authURL = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`
  const tokenURL = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`

  const defaultClient = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri ?? null)

  function getClient(redirectUri?: string): OAuth2Client {
    if (!redirectUri || (config.redirectUri && redirectUri === config.redirectUri))
      return defaultClient

    return new OAuth2Client(config.clientId, config.clientSecret, redirectUri)
  }

  return {
    id: 'microsoft-entra-id',

    async getAuthorizationUrl(state: string, codeVerifier: string, options?: { scopes?: string[], redirectUri?: string }) {
      const client = getClient(options?.redirectUri)
      const scopes = options?.scopes ?? config.scope ?? ['openid', 'profile', 'email', 'User.Read']
      const url = await client.createAuthorizationURLWithPKCE(authURL, state, CodeChallengeMethod.S256, codeVerifier, scopes)
      return url
    },

    async validateCallback(code: string, codeVerifier: string, redirectUri?: string) {
      const client = getClient(redirectUri)
      const tokens = await client.validateAuthorizationCode(tokenURL, code, codeVerifier)
      const user = await getUser(tokens.accessToken())
      return { tokens, user }
    },
  }
}
