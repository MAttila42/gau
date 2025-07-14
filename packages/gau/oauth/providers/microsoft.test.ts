import { describe, expect, it, vi } from 'vitest'
import { MicrosoftEntraId } from './microsoft'

const mockReader = {
  result: 'data:image/jpeg;base64,mocked_base64_string',
  onloadend: () => {},
  onerror: () => {},
  readAsDataURL(this: any, _blob: Blob) {
    this.onloadend()
  },
}
vi.stubGlobal('FileReader', vi.fn(() => mockReader))

vi.stubGlobal('fetch', vi.fn((url: string) => {
  if (url.includes('/v1.0/me/photo/$value')) {
    return Promise.resolve(new Response(new Blob(['mock_photo_data']), {
      headers: { 'Content-Type': 'image/jpeg' },
    }))
  }
  if (url.includes('/v1.0/me')) {
    const mockUser = { id: 'mock-ms-id', displayName: 'Test User', mail: 'test@example.com', userPrincipalName: 'test@example.com' }
    return Promise.resolve(new Response(JSON.stringify(mockUser), {
      headers: { 'Content-Type': 'application/json' },
    }))
  }
  return Promise.reject(new Error(`Unhandled fetch mock for ${url}`))
}))

vi.mock('arctic', async (importOriginal) => {
  const original = await importOriginal<typeof import('arctic')>()
  const mockTokens = {
    accessToken: () => 'test_access_token',
    accessTokenExpiresAt: () => new Date(Date.now() + 3600 * 1000),
    refreshToken: () => 'test_refresh_token',
  }
  return {
    ...original,
    OAuth2Client: vi.fn(() => ({
      createAuthorizationURLWithPKCE: vi.fn((authURL: string) => new URL(`${authURL}?mock=true`)),
      validateAuthorizationCode: vi.fn(() => Promise.resolve(mockTokens)),
    })),
  }
})

describe('microsoftEntraId Provider', () => {
  const provider = MicrosoftEntraId({
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:5173/api/auth/microsoft-entra-id/callback',
  })

  it('should create an authorization URL', async () => {
    const url = await provider.getAuthorizationUrl('state', 'code-verifier')
    expect(url.toString()).toContain('login.microsoftonline.com/common/oauth2/v2.0/authorize')
    expect(url.toString()).toContain('mock=true')
  })

  it('should validate the callback and return user data', async () => {
    const { user, tokens } = await provider.validateCallback('code', 'code-verifier')

    mockReader.onloadend()

    expect(tokens.accessToken()).toBe('test_access_token')
    expect(user.id).toBe('mock-ms-id')
    expect(user.name).toBe('Test User')
    expect(user.email).toBe('test@example.com')
    expect(user.avatar).toBe('data:image/jpeg;base64,mocked_base64_string')
    expect(user.raw).toEqual({ id: 'mock-ms-id', displayName: 'Test User', mail: 'test@example.com', userPrincipalName: 'test@example.com' })
  })
})
