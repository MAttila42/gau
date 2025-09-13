import type { Auth } from '../../../src/core/createAuth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryAdapter } from '../../../src/adapters'
import {
  CALLBACK_URI_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  PKCE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from '../../../src/core/cookies'
import { createAuth } from '../../../src/core/createAuth'
import { handleCallback } from '../../../src/core/handlers/callback'
import { mockProvider, setup } from '../../handler'

describe('callback handler', () => {
  let auth: Auth

  beforeEach(() => {
    ({ auth } = setup())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should create a new user, link account, and set session cookie', async () => {
    const state = 'state123'
    const code = 'code123'
    const request = new Request(`http://localhost/api/auth/mock/callback?code=${code}&state=${state}`)
    request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=${state}; ${PKCE_COOKIE_NAME}=pkce; ${CALLBACK_URI_COOKIE_NAME}=uri`)

    const response = await handleCallback(request, auth, 'mock')

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

    await handleCallback(request, auth, 'mock')

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

    await handleCallback(request, auth, 'mock')

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

    const response = await handleCallback(request, auth, 'mock')
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Failed to create user')
  })

  it('should return 500 if account linking fails', async () => {
    vi.spyOn(auth, 'linkAccount').mockRejectedValueOnce(new Error('DB error'))
    const state = 'state123'
    const code = 'code123'
    const request = new Request(`http://localhost/api/auth/mock/callback?code=${code}&state=${state}`)
    request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=${state}; ${PKCE_COOKIE_NAME}=pkce;`)

    const response = await handleCallback(request, auth, 'mock')
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toBe('Failed to link account')
  })

  it('should return 400 if provider is not found during callback', async () => {
    const request = new Request('http://localhost/api/auth/unknown-provider/callback?code=c&state=s')
    const response = await handleCallback(request, auth, 'unknown-provider')
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toBe('Provider not found')
  })

  it('should return 400 for missing code or state', async () => {
    const request = new Request('http://localhost/api/auth/mock/callback')
    const response = await handleCallback(request, auth, 'mock')
    expect(response.status).toBe(400)
  })

  it('should return 403 for invalid CSRF token', async () => {
    const request = new Request('http://localhost/api/auth/mock/callback?code=c&state=s')
    request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=wrong-state`)
    const response = await handleCallback(request, auth, 'mock')
    expect(response.status).toBe(403)
  })

  it('should return 400 for missing PKCE verifier', async () => {
    const request = new Request('http://localhost/api/auth/mock/callback?code=c&state=s')
    request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=s`)
    const response = await handleCallback(request, auth, 'mock')
    expect(response.status).toBe(400)
  })

  it('should handle malformed redirectTo in state gracefully', async () => {
    const state = `state123.not-base64`
    const request = new Request(`http://localhost/api/auth/mock/callback?code=c&state=${state}`)
    request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=state123; ${PKCE_COOKIE_NAME}=pkce`)

    const response = await handleCallback(request, auth, 'mock')
    expect(response.status).toBe(302)
    expect(response.headers.get('Location')).toBe('/') // falls back to root
  })

  it('should return HTML for mobile redirects', async () => {
    const state = `state123.${btoa('https://mobile.app/callback')}`
    const request = new Request(`http://localhost/api/auth/mock/callback?code=c&state=${state}`)
    request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=state123; ${PKCE_COOKIE_NAME}=pkce`)

    const response = await handleCallback(request, auth, 'mock')
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/html')

    const html = await response.text()
    expect(html).toContain('const url = "https://mobile.app/callback#token=')
  })

  it('should return HTML for desktop/mobile redirects', async () => {
    const state = `state123.${btoa('gau://callback')}`
    const request = new Request(`http://localhost/api/auth/mock/callback?code=c&state=${state}`)
    request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=state123; ${PKCE_COOKIE_NAME}=pkce`)

    const response = await handleCallback(request, auth, 'mock')
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

    const response = await handleCallback(request, auth, 'mock')
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.user).toBeDefined()
    expect(body.user.email).toBe('user@provider.com')
  })

  it('passes callbackUri from cookie to provider.validateCallback', async () => {
    const state = 'state123'
    const code = 'code123'
    const request = new Request(`http://localhost/api/auth/mock/callback?code=${code}&state=${state}`)
    request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=${state}; ${PKCE_COOKIE_NAME}=pkce; ${CALLBACK_URI_COOKIE_NAME}=app://custom-callback`)

    await handleCallback(request, auth, 'mock')
    const validateArgs = (mockProvider.validateCallback as any).mock.calls.at(-1)
    expect(validateArgs[2]).toBe('app://custom-callback')
  })

  describe('session strategy', () => {
    it('should force token strategy for same-origin when strategy is "token"', async () => {
      auth = createAuth({
        adapter: MemoryAdapter(),
        providers: [mockProvider],
        jwt: { secret: 'test-secret', algorithm: 'HS256', ttl: 3600 },
        session: { strategy: 'token' },
      })

      const state = `state123.${btoa('/dashboard')}`
      const request = new Request(`http://localhost/api/auth/mock/callback?code=c&state=${state}`)
      request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=state123; ${PKCE_COOKIE_NAME}=pkce`)

      const response = await handleCallback(request, auth, 'mock')
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

      const state = `state123.${btoa('https://trusted.app.com/callback')}`
      const request = new Request(`http://localhost/api/auth/mock/callback?code=c&state=${state}`)
      request.headers.set('Cookie', `${CSRF_COOKIE_NAME}=state123; ${PKCE_COOKIE_NAME}=pkce`)

      const response = await handleCallback(request, auth, 'mock')
      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('https://trusted.app.com/callback')
      const cookies = response.headers.getSetCookie()
      expect(cookies.some(c => c.startsWith(SESSION_COOKIE_NAME))).toBe(true)
    })
  })
})
