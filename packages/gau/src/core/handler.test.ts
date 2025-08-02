import type { Mock } from 'vitest'
import type { GauSession } from '../core'
import type { OAuthProvider } from '../oauth'
import type { Auth } from './createAuth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryAdapter } from '../adapters'
import {
  CALLBACK_URI_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  PKCE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from './cookies'
import { createAuth } from './createAuth'
import { createHandler } from './handler'

const mockProvider: OAuthProvider<'mock'> = {
  id: 'mock',
  requiresRedirectUri: true,
  getAuthorizationUrl: vi.fn().mockImplementation(async () => new URL('https://provider.com/auth')),
  validateCallback: vi.fn().mockResolvedValue({
    user: { id: 'provider-user-id', name: 'Provider User', email: 'user@provider.com', emailVerified: true, avatar: 'https://avatar.url' },
    tokens: {
      accessToken: () => 'access-token',
      refreshToken: () => 'refresh-token',
      idToken: () => 'id-token',
      accessTokenExpiresAt: () => new Date(Date.now() + 3600 * 1000),
      scopes: () => ['read'],
      tokenType: () => 'Bearer',
    },
  }),
}

describe('createHandler', () => {
  let auth: Auth
  let handler: ReturnType<typeof createHandler>

  beforeEach(() => {
    vi.clearAllMocks()
    ;(mockProvider.getAuthorizationUrl as Mock).mockResolvedValue(new URL('https://provider.com/auth'))
    ;(mockProvider.validateCallback as Mock).mockResolvedValue({
      user: { id: 'provider-user-id', name: 'Provider User', email: 'user@provider.com', emailVerified: true, avatar: 'https://avatar.url' },
      tokens: {
        accessToken: () => 'access-token',
        refreshToken: () => 'refresh-token',
        idToken: () => 'id-token',
        accessTokenExpiresAt: () => new Date(Date.now() + 3600 * 1000),
        scopes: () => ['read'],
        tokenType: () => 'Bearer',
      },
    })

    auth = createAuth({
      adapter: MemoryAdapter(),
      providers: [mockProvider],
      jwt: { secret: 'test-secret', algorithm: 'HS256', ttl: 3600 },
      trustHosts: ['trusted.app.com'],
    })
    handler = createHandler(auth)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('routing', () => {
    it('should return 404 for unknown paths', async () => {
      const request = new Request('http://localhost/api/auth/a/b/c')
      const response = await handler(request)
      expect(response.status).toBe(404)
    })

    it('should return 404 for unknown actions', async () => {
      const request = new Request('http://localhost/api/auth/mock/unknown')
      const response = await handler(request)
      expect(response.status).toBe(404)
    })

    it('should return 404 for requests without action', async () => {
      const request = new Request('http://localhost/api/auth/')
      const response = await handler(request)
      expect(response.status).toBe(404)
    })

    it('should return 405 for wrong method', async () => {
      const request = new Request('http://localhost/api/auth/mock', { method: 'PUT' })
      const response = await handler(request)
      expect(response.status).toBe(405)
    })

    it('should handle OPTIONS requests for CORS preflight', async () => {
      const request = new Request('http://localhost/api/auth/mock', {
        method: 'OPTIONS',
        headers: { Origin: 'http://localhost:3000' },
      })
      const response = await handler(request)
      expect(response.status).toBe(204)
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000')
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST')
    })

    it('should return 403 for POST requests from untrusted origins', async () => {
      const request = new Request('http://localhost/api/auth/signout', {
        method: 'POST',
        headers: { Origin: 'https://untrusted.com' },
      })
      const response = await handler(request)
      expect(response.status).toBe(403)
    })

    it('should allow POST requests from trusted origins', async () => {
      const request = new Request('http://localhost/api/auth/signout', {
        method: 'POST',
        headers: { Origin: 'https://trusted.app.com' },
      })
      const response = await handler(request)
      expect(response.status).toBe(200)
    })

    it('should return 400 if provider is not found during sign-in', async () => {
      const request = new Request('http://localhost/api/auth/unknown-provider')
      const response = await handler(request)
      expect(response.status).toBe(400)
      const body = await response.json<{ error: string }>()
      expect(body.error).toBe('Provider not found')
    })
  })

  describe('sign In', () => {
    it('should redirect to provider auth URL and set cookies', async () => {
      const request = new Request('http://localhost/api/auth/mock')
      const response = await handler(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('https://provider.com/auth')

      const cookies = response.headers.getSetCookie()
      expect(cookies.some(c => c.startsWith(CSRF_COOKIE_NAME))).toBe(true)
      expect(cookies.some(c => c.startsWith(PKCE_COOKIE_NAME))).toBe(true)
      expect(cookies.some(c => c.startsWith(CALLBACK_URI_COOKIE_NAME))).toBe(true)
    })

    it('should handle redirectTo parameter', async () => {
      const request = new Request('http://localhost/api/auth/mock?redirectTo=/dashboard')
      await handler(request)

      const state = (mockProvider.getAuthorizationUrl as any).mock.calls[0][0]
      const decodedRedirect = atob(state.split('.')[1])
      expect(decodedRedirect).toBe('/dashboard')
    })

    it('should handle callbackUri parameter', async () => {
      const request = new Request('http://localhost/api/auth/mock?callbackUri=app://callback')
      await handler(request)

      const options = (mockProvider.getAuthorizationUrl as any).mock.calls[0][2]
      expect(options.redirectUri).toBe('app://callback')
    })

    it('should return JSON with auth URL if redirect=false', async () => {
      const request = new Request('http://localhost/api/auth/mock?redirect=false')
      const response = await handler(request)
      const data = await response.json<{ url: string }>()

      expect(response.status).toBe(200)
      expect(data.url).toBe('https://provider.com/auth')
      expect(response.headers.has('Set-Cookie')).toBe(true)
    })

    it('should return 500 if auth URL cannot be created', async () => {
      (mockProvider.getAuthorizationUrl as any).mockResolvedValueOnce(null)
      const request = new Request('http://localhost/api/auth/mock')
      const response = await handler(request)
      expect(response.status).toBe(500)
      const body = await response.json<{ error: string }>()
      expect(body.error).toBe('Could not create authorization URL')
    })

    it('should return 400 for invalid redirectTo URL', async () => {
      const request = new Request('http://localhost/api/auth/mock?redirectTo=//invalid-url')
      const response = await handler(request)
      expect(response.status).toBe(400)
      const body = await response.json<{ error: string }>()
      expect(body.error).toBe('Invalid "redirectTo" URL')
    })

    it('should return 400 for untrusted redirectTo host', async () => {
      const request = new Request('http://localhost/api/auth/mock?redirectTo=https://evil.com')
      const response = await handler(request)
      expect(response.status).toBe(400)
      const body = await response.json<{ error: string }>()
      expect(body.error).toBe('Untrusted redirect host')
    })

    it('should allow trusted redirectTo host', async () => {
      const request = new Request('http://localhost/api/auth/mock?redirectTo=https://trusted.app.com/profile')
      const response = await handler(request)
      expect(response.status).toBe(302)
    })

    it('should allow same-host redirectTo', async () => {
      const request = new Request('http://localhost/api/auth/mock?redirectTo=/profile')
      const response = await handler(request)
      expect(response.status).toBe(302)
    })

    it('should allow any host if trustHosts is "all"', async () => {
      auth.trustHosts = 'all'
      handler = createHandler(auth)
      const request = new Request('http://localhost/api/auth/mock?redirectTo=https://any.host.com/profile')
      const response = await handler(request)
      expect(response.status).toBe(302)
    })
  })

  describe('callback', () => {
    it('should create a new user, link account, and set session cookie', async () => {
      const state = 'state123'
      const code = 'code123'
      const request = new Request(`http://localhost/api/auth/mock/callback?code=${code}&state=${state}`)
      request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=${state}; ${PKCE_COOKIE_NAME}=pkce; ${CALLBACK_URI_COOKIE_NAME}=uri`)

      const response = await handler(request)

      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('/')

      const cookies = response.headers.getSetCookie()
      expect(cookies.some(c => c.startsWith(SESSION_COOKIE_NAME))).toBe(true)
      expect(cookies.some(c => c.startsWith(CSRF_COOKIE_NAME) && c.includes('Max-Age=0'))).toBe(true)
      expect(cookies.some(c => c.startsWith(PKCE_COOKIE_NAME) && c.includes('Max-Age=0'))).toBe(true)
      expect(cookies.some(c => c.startsWith(CALLBACK_URI_COOKIE_NAME) && c.includes('Max-Age=0'))).toBe(true)

      const user = await auth.getUserByEmail('user@provider.com')
      expect(user).not.toBeNull()
      expect(user?.name).toBe('Provider User')
    })

    it('should link to an existing user by email', async () => {
      const existingUser = await auth.createUser({ email: 'user@provider.com', name: 'Existing User' })
      const state = 'state123'
      const code = 'code123'
      const request = new Request(`http://localhost/api/auth/mock/callback?code=${code}&state=${state}`)
      request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=${state}; ${PKCE_COOKIE_NAME}=pkce; ${CALLBACK_URI_COOKIE_NAME}=uri`)

      await handler(request)

      const linkedUser = await auth.getUserByAccount('mock', 'provider-user-id')
      expect(linkedUser).not.toBeNull()
      expect(linkedUser?.id).toBe(existingUser.id)
    })

    it('should link to an existing user with unverified email if autoLink is always', async () => {
      auth.autoLink = 'always'
      const existingUser = await auth.createUser({ email: 'user@provider.com', name: 'Existing User', emailVerified: false })
      const state = 'state123'
      const code = 'code123'
      const request = new Request(`http://localhost/api/auth/mock/callback?code=${code}&state=${state}`)
      request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=${state}; ${PKCE_COOKIE_NAME}=pkce; ${CALLBACK_URI_COOKIE_NAME}=uri`)

      await handler(request)

      const linkedUser = await auth.getUserByAccount('mock', 'provider-user-id')
      expect(linkedUser).not.toBeNull()
      expect(linkedUser?.id).toBe(existingUser.id)
      const updatedUser = await auth.getUser(existingUser.id)
      expect(updatedUser?.emailVerified).toBe(true)
    })

    it('should return 500 if user creation fails', async () => {
      vi.spyOn(auth, 'createUser').mockRejectedValueOnce(new Error('DB error'))
      const state = 'state123'
      const code = 'code123'
      const request = new Request(`http://localhost/api/auth/mock/callback?code=${code}&state=${state}`)
      request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=${state}; ${PKCE_COOKIE_NAME}=pkce;`)

      const response = await handler(request)
      expect(response.status).toBe(500)
      const body = await response.json<{ error: string }>()
      expect(body.error).toBe('Failed to create user')
    })

    it('should return 500 if account linking fails', async () => {
      vi.spyOn(auth, 'linkAccount').mockRejectedValueOnce(new Error('DB error'))
      const state = 'state123'
      const code = 'code123'
      const request = new Request(`http://localhost/api/auth/mock/callback?code=${code}&state=${state}`)
      request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=${state}; ${PKCE_COOKIE_NAME}=pkce;`)

      const response = await handler(request)
      expect(response.status).toBe(500)
      const body = await response.json<{ error: string }>()
      expect(body.error).toBe('Failed to link account')
    })

    it('should return 400 if provider is not found during callback', async () => {
      const request = new Request('http://localhost/api/auth/unknown-provider/callback?code=c&state=s')
      const response = await handler(request)
      expect(response.status).toBe(400)
      const body = await response.json<{ error: string }>()
      expect(body.error).toBe('Provider not found')
    })

    it('should return 400 for missing code or state', async () => {
      const request = new Request('http://localhost/api/auth/mock/callback')
      const response = await handler(request)
      expect(response.status).toBe(400)
    })

    it('should return 403 for invalid CSRF token', async () => {
      const request = new Request('http://localhost/api/auth/mock/callback?code=c&state=s')
      request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=wrong-state`)
      const response = await handler(request)
      expect(response.status).toBe(403)
    })

    it('should return 400 for missing PKCE verifier', async () => {
      const request = new Request('http://localhost/api/auth/mock/callback?code=c&state=s')
      request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=s`)
      const response = await handler(request)
      expect(response.status).toBe(400)
    })

    it('should handle malformed redirectTo in state gracefully', async () => {
      const state = `state123.not-base64`
      const request = new Request(`http://localhost/api/auth/mock/callback?code=c&state=${state}`)
      request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=state123; ${PKCE_COOKIE_NAME}=pkce`)

      const response = await handler(request)
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('/') // falls back to root
    })

    it('should return HTML for mobile redirects', async () => {
      const state = `state123.${btoa('https://mobile.app/callback')}`
      const request = new Request(`http://localhost/api/auth/mock/callback?code=c&state=${state}`)
      request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=state123; ${PKCE_COOKIE_NAME}=pkce`)

      const response = await handler(request)
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('text/html')

      const html = await response.text()
      expect(html).toContain('const url = "https://mobile.app/callback#token=')
    })

    it('should return HTML for desktop/mobile redirects', async () => {
      const state = `state123.${btoa('gau://callback')}`
      const request = new Request(`http://localhost/api/auth/mock/callback?code=c&state=${state}`)
      request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=state123; ${PKCE_COOKIE_NAME}=pkce`)

      const response = await handler(request)
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('text/html')

      const html = await response.text()
      expect(html).toContain('const url = "gau://callback#token=')
      expect(html).toContain('window.location.href = url;')
    })

    it('should handle redirect=false on callback', async () => {
      const state = 'state123'
      const code = 'code123'
      const request = new Request(`http://localhost/api/auth/mock/callback?code=${code}&state=${state}&redirect=false`)
      request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=${state}; ${PKCE_COOKIE_NAME}=pkce;`)

      const response = await handler(request)
      expect(response.status).toBe(200)
      const body = await response.json<{ user: { email: string } }>()
      expect(body.user).toBeDefined()
      expect(body.user.email).toBe('user@provider.com')
    })
  })

  describe('session', () => {
    it('should return session data for a valid token', async () => {
      const user = await auth.createUser({ name: 'Test User' })
      const sessionToken = await auth.createSession(user.id)
      const request = new Request('http://localhost/api/auth/session', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      })

      const response = await handler(request)
      const data = await response.json<GauSession>()

      expect(response.status).toBe(200)
      expect(data.user!.id).toBe(user.id)
      expect(data.session!.sub).toBe(user.id)
    })

    it('should return session data for a valid cookie', async () => {
      const user = await auth.createUser({ name: 'Test User' })
      const sessionToken = await auth.createSession(user.id)
      const request = new Request('http://localhost/api/auth/session', {
        headers: { Cookie: `${SESSION_COOKIE_NAME}=${sessionToken}` },
      })

      const response = await handler(request)
      const data = await response.json<GauSession>()

      expect(response.status).toBe(200)
      expect(data.user!.id).toBe(user.id)
    })

    it('should return null session for no token', async () => {
      const request = new Request('http://localhost/api/auth/session')
      const response = await handler(request)
      const data = await response.json<GauSession>()

      expect(response.status).toBe(200)
      expect(data.user).toBeNull()
      expect(data.session).toBeNull()
    })

    it('should return 401 for an invalid session token', async () => {
      const request = new Request('http://localhost/api/auth/session', {
        headers: { Authorization: 'Bearer invalid-token' },
      })
      const response = await handler(request)
      expect(response.status).toBe(401)
      const data = await response.json<GauSession>()
      expect(data.user).toBeNull()
      expect(data.session).toBeNull()
    })

    it('should return 500 if session validation throws', async () => {
      const user = await auth.createUser({ name: 'Test User' })
      const sessionToken = await auth.createSession(user.id)
      vi.spyOn(auth, 'validateSession').mockRejectedValueOnce(new Error('Internal Server Error'))

      const request = new Request('http://localhost/api/auth/session', {
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
      const response = await handler(request)
      expect(response.status).toBe(500)
      const data = await response.json<{ error: string }>()
      expect(data.error).toBe('Failed to validate session')
    })
  })

  describe('sign Out', () => {
    it('should clear the session cookie', async () => {
      const request = new Request('http://localhost/api/auth/signout', {
        method: 'POST',
        headers: { Origin: 'http://localhost' },
      })
      request.headers.set('Cookie', `${SESSION_COOKIE_NAME}=some-token`)

      const response = await handler(request)

      expect(response.status).toBe(200)
      const data = await response.json<{ message: string }>()
      expect(data.message).toBe('Signed out')

      const cookieHeader = response.headers.get('Set-Cookie')
      expect(cookieHeader).toContain(`${SESSION_COOKIE_NAME}=;`)
      expect(cookieHeader).toContain('Max-Age=0')
    })

    it('should sign out even with no session', async () => {
      const request = new Request('http://localhost/api/auth/signout', {
        method: 'POST',
        headers: { Origin: 'http://localhost' },
      })
      const response = await handler(request)
      expect(response.status).toBe(200)
      const data = await response.json<{ message: string }>()
      expect(data.message).toBe('Signed out')
    })
  })

  describe('session strategy', () => {
    it('should force token strategy for same-origin when strategy is "token"', async () => {
      auth = createAuth({
        adapter: MemoryAdapter(),
        providers: [mockProvider],
        jwt: { secret: 'test-secret', algorithm: 'HS256', ttl: 3600 },
        session: { strategy: 'token' },
      })
      handler = createHandler(auth)

      const state = `state123.${btoa('/dashboard')}`
      const request = new Request(`http://localhost/api/auth/mock/callback?code=c&state=${state}`)
      request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=state123; ${PKCE_COOKIE_NAME}=pkce`)

      const response = await handler(request)
      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toContain('text/html')
      const html = await response.text()
      expect(html).toContain('const url = "http://localhost/dashboard#token=')
    })

    it('should force cookie strategy for cross-origin when strategy is "cookie"', async () => {
      auth = createAuth({
        adapter: MemoryAdapter(),
        providers: [mockProvider],
        jwt: { secret: 'test-secret', algorithm: 'HS256', ttl: 3600 },
        session: { strategy: 'cookie' },
        trustHosts: ['trusted.app.com'],
      })
      handler = createHandler(auth)

      const state = `state123.${btoa('https://trusted.app.com/callback')}`
      const request = new Request(`http://localhost/api/auth/mock/callback?code=c&state=${state}`)
      request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=state123; ${PKCE_COOKIE_NAME}=pkce`)

      const response = await handler(request)
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('https://trusted.app.com/callback')
      const cookies = response.headers.getSetCookie()
      expect(cookies.some(c => c.startsWith(SESSION_COOKIE_NAME))).toBe(true)
    })
  })
})
