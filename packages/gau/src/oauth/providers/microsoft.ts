import type { AuthUser, OAuthProvider, OAuthProviderConfig, RefreshedTokens } from '../index'
import { CodeChallengeMethod, OAuth2Client } from 'arctic'

// https://learn.microsoft.com/en-us/entra/identity-platform/v2-protocols-oidc
const MICROSOFT_USER_INFO_URL = 'https://graph.microsoft.com/v1.0/me'

// https://learn.microsoft.com/en-us/graph/api/profilephoto-get?view=graph-rest-1.0
const MICROSOFT_USER_PHOTO_URL = 'https://graph.microsoft.com/v1.0/me/photo/$value'

interface MicrosoftConfig extends OAuthProviderConfig {
  tenant?: 'common' | 'organizations' | 'consumers' | string
}

interface MicrosoftUser {
  id: string
  displayName: string
  mail: string | null
  userPrincipalName: string
  [key: string]: unknown
}

function base64url_decode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  const padLength = (4 - (base64.length % 4)) % 4
  const padded = base64.padEnd(base64.length + padLength, '=')
  const binary_string = atob(padded)
  const len = binary_string.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++)
    bytes[i] = binary_string.charCodeAt(i)

  return bytes
}

async function getUser(accessToken: string, idToken: string | null): Promise<AuthUser> {
  const userResponse = await fetch(MICROSOFT_USER_INFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })
  const userData: MicrosoftUser = await userResponse.json()

  let email: string | null = userData.mail ?? userData.userPrincipalName
  let emailVerified = false
  if (idToken) {
    try {
      const parts = idToken.split('.')
      const payload = JSON.parse(new TextDecoder().decode(base64url_decode(parts[1]!))) as Record<string, any>
      const personalTenantId = '9188040d-6c67-4c5b-b112-36a304b66dad'

      // For work/school accounts, the `verified_primary_email` is the source of truth.
      if (payload.verified_primary_email) {
        const primaryEmail = Array.isArray(payload.verified_primary_email)
          ? payload.verified_primary_email[0]
          : payload.verified_primary_email

        if (typeof primaryEmail === 'string') {
          email = primaryEmail
          emailVerified = true
        }
      }
      // For personal accounts, the `email` claim is reliable and verified.
      else if (payload.tid === personalTenantId) {
        email = payload.email ?? email
        emailVerified = true
      }
      // Legacy fallback for `xms_edov`.
      else if (payload.xms_edov === true) {
        email = payload.email ?? email
        emailVerified = true
      }
    }
    catch {
    }
  }

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
    email,
    emailVerified,
    avatar,
    raw: userData,
  }
}

export function Microsoft(config: MicrosoftConfig): OAuthProvider<'microsoft'> {
  const tenant = config.tenant ?? 'common'

  const authURL = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`
  const tokenURL = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`

  const defaultClient = new OAuth2Client(config.clientId, config.clientSecret, config.redirectUri ?? null)

  function getClient(redirectUri?: string): OAuth2Client {
    if (!redirectUri || redirectUri === config.redirectUri)
      return defaultClient

    return new OAuth2Client(config.clientId, config.clientSecret, redirectUri)
  }

  return {
    id: 'microsoft',
    requiresRedirectUri: true,

    async getAuthorizationUrl(state: string, codeVerifier: string, options?: { scopes?: string[], redirectUri?: string }) {
      const client = getClient(options?.redirectUri)
      const scopes = options?.scopes ?? config.scope ?? ['openid', 'profile', 'email', 'User.Read']
      const url = await client.createAuthorizationURLWithPKCE(authURL, state, CodeChallengeMethod.S256, codeVerifier, scopes)
      return url
    },

    async validateCallback(code: string, codeVerifier: string, redirectUri?: string) {
      const client = getClient(redirectUri)
      const tokens = await client.validateAuthorizationCode(tokenURL, code, codeVerifier)
      const user = await getUser(tokens.accessToken(), tokens.idToken())
      return { tokens, user }
    },

    async refreshAccessToken(refreshToken: string): Promise<RefreshedTokens> {
      const body = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        scope: (config.scope ?? ['openid', 'profile', 'email', 'User.Read']).join(' '),
      })
      const res = await fetch(tokenURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      })
      const json = await res.json() as any
      if (!res.ok)
        throw json

      const expiresIn: number | undefined = json.expires_in
      const expiresAt = typeof expiresIn === 'number' ? Math.floor(Date.now() / 1000) + Math.floor(expiresIn) : undefined

      return {
        accessToken: json.access_token,
        refreshToken: json.refresh_token ?? refreshToken,
        expiresAt: expiresAt ?? null,
        idToken: json.id_token ?? null,
        tokenType: json.token_type ?? null,
        scope: json.scope ?? null,
      }
    },
  }
}
