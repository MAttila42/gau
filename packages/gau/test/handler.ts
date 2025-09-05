import type { Mock } from 'vitest'
import type { OAuthProvider } from '../src/oauth'
import { vi } from 'vitest'
import { MemoryAdapter } from '../src/adapters'
import { createAuth } from '../src/core/createAuth'

export const mockProvider: OAuthProvider<'mock'> = {
  id: 'mock',
  requiresRedirectUri: true,
  getAuthorizationUrl: vi.fn().mockImplementation(async () => new URL('https://provider.com/auth')),
  validateCallback: vi.fn().mockResolvedValue({
    user: { id: 'provider-user-id', name: 'Provider User', email: 'user@provider.com', emailVerified: true, avatar: 'https://avatar.url' },
    tokens: {
      data: {},
      accessToken: () => 'access-token',
      refreshToken: () => 'refresh-token',
      idToken: () => 'id-token',
      accessTokenExpiresAt: () => new Date(Date.now() + 3600 * 1000),
      accessTokenExpiresInSeconds: () => 3600,
      scopes: () => ['read'],
      hasScopes: () => true,
      hasRefreshToken: () => true,
      tokenType: () => 'Bearer',
    },
  }),
}

export function setup() {
  vi.clearAllMocks()
  void (mockProvider.getAuthorizationUrl as Mock).mockResolvedValue(new URL('https://provider.com/auth'))
  void (mockProvider.validateCallback as Mock).mockResolvedValue({
    user: { id: 'provider-user-id', name: 'Provider User', email: 'user@provider.com', emailVerified: true, avatar: 'https://avatar.url' },
    tokens: {
      data: {},
      accessToken: () => 'access-token',
      refreshToken: () => 'refresh-token',
      idToken: () => 'id-token',
      accessTokenExpiresAt: () => new Date(Date.now() + 3600 * 1000),
      accessTokenExpiresInSeconds: () => 3600,
      scopes: () => ['read'],
      hasScopes: () => true,
      hasRefreshToken: () => true,
      tokenType: () => 'Bearer',
    },
  })

  const auth = createAuth({
    adapter: MemoryAdapter(),
    providers: [mockProvider],
    jwt: { secret: 'test-secret', algorithm: 'HS256', ttl: 3600 },
    trustHosts: ['trusted.app.com'],
  })

  return { auth, mockProvider }
}
