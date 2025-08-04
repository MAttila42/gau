import type { Auth } from '../createAuth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setup } from '../../../../../tests/handler'
import { SESSION_COOKIE_NAME } from '../cookies'
import { handleLink, handleUnlink } from './link'

describe('link handler', () => {
  let auth: Auth

  beforeEach(() => {
    void ({ auth } = setup())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('handleLink', () => {
    it('should redirect to provider auth URL with linking token', async () => {
      const user = await auth.createUser({ name: 'Test User' })
      const sessionToken = await auth.createSession(user.id)
      const request = new Request('http://localhost/api/auth/link/mock')
      request.headers.set('Cookie', `${SESSION_COOKIE_NAME}=${sessionToken}`)

      const response = await handleLink(request, auth, 'mock')

      expect(response.status).toBe(302)
      expect(response.headers.get('Location')).toBe('https://provider.com/auth')

      const cookies = response.headers.getSetCookie()
      expect(cookies.some(c => c.includes('__gau-linking-token'))).toBe(true)
    })

    it('should work with Authorization header', async () => {
      const user = await auth.createUser({ name: 'Test User' })
      const sessionToken = await auth.createSession(user.id)
      const request = new Request('http://localhost/api/auth/link/mock')
      request.headers.set('Authorization', `Bearer ${sessionToken}`)

      const response = await handleLink(request, auth, 'mock')

      expect(response.status).toBe(302)
    })

    it('should work with token in URL params', async () => {
      const user = await auth.createUser({ name: 'Test User' })
      const sessionToken = await auth.createSession(user.id)
      const request = new Request(`http://localhost/api/auth/link/mock?token=${sessionToken}`)

      const response = await handleLink(request, auth, 'mock')

      expect(response.status).toBe(302)
    })

    it('should return 401 for no session token', async () => {
      const request = new Request('http://localhost/api/auth/link/mock')

      const response = await handleLink(request, auth, 'mock')

      expect(response.status).toBe(401)
      const body = await response.json<{ error: string }>()
      expect(body.error).toBe('Unauthorized')
    })

    it('should return 401 for invalid session token', async () => {
      const request = new Request('http://localhost/api/auth/link/mock')
      request.headers.set('Cookie', `${SESSION_COOKIE_NAME}=invalid-token`)

      const response = await handleLink(request, auth, 'mock')

      expect(response.status).toBe(401)
      const body = await response.json<{ error: string }>()
      expect(body.error).toBe('Unauthorized')
    })
  })

  describe('handleUnlink', () => {
    it('should unlink account successfully', async () => {
      const user = await auth.createUser({ name: 'Test User' })
      const sessionToken = await auth.createSession(user.id)

      // Link an account first
      await auth.linkAccount({
        userId: user.id,
        provider: 'mock',
        providerAccountId: 'mock-account-id',
      })

      const request = new Request('http://localhost/api/auth/unlink/mock', {
        method: 'POST',
      })
      request.headers.set('Cookie', `${SESSION_COOKIE_NAME}=${sessionToken}`)

      const response = await handleUnlink(request, auth, 'mock')

      expect(response.status).toBe(200)
      const body = await response.json<{ message: string }>()
      expect(body.message).toBe('Account unlinked successfully')

      // Verify account was unlinked
      const accounts = await auth.getAccounts(user.id)
      expect(accounts).toHaveLength(0)
    })

    it('should work with Authorization header', async () => {
      const user = await auth.createUser({ name: 'Test User' })
      const sessionToken = await auth.createSession(user.id)

      // Link an account first
      await auth.linkAccount({
        userId: user.id,
        provider: 'mock',
        providerAccountId: 'mock-account-id',
      })

      const request = new Request('http://localhost/api/auth/unlink/mock', {
        method: 'POST',
      })
      request.headers.set('Authorization', `Bearer ${sessionToken}`)

      const response = await handleUnlink(request, auth, 'mock')

      expect(response.status).toBe(200)
    })

    it('should return 401 for no session token', async () => {
      const request = new Request('http://localhost/api/auth/unlink/mock', {
        method: 'POST',
      })

      const response = await handleUnlink(request, auth, 'mock')

      expect(response.status).toBe(401)
      const body = await response.json<{ error: string }>()
      expect(body.error).toBe('Unauthorized')
    })

    it('should return 401 for invalid session token', async () => {
      const request = new Request('http://localhost/api/auth/unlink/mock', {
        method: 'POST',
      })
      request.headers.set('Cookie', `${SESSION_COOKIE_NAME}=invalid-token`)

      const response = await handleUnlink(request, auth, 'mock')

      expect(response.status).toBe(401)
      const body = await response.json<{ error: string }>()
      expect(body.error).toBe('Unauthorized')
    })

    it('should return 400 when trying to unlink the last account', async () => {
      const user = await auth.createUser({ name: 'Test User' })
      const sessionToken = await auth.createSession(user.id)

      // Only link one account
      await auth.linkAccount({
        userId: user.id,
        provider: 'mock',
        providerAccountId: 'mock-account-id',
      })

      const request = new Request('http://localhost/api/auth/unlink/mock', {
        method: 'POST',
      })
      request.headers.set('Cookie', `${SESSION_COOKIE_NAME}=${sessionToken}`)

      const response = await handleUnlink(request, auth, 'mock')

      expect(response.status).toBe(400)
      const body = await response.json<{ error: string }>()
      expect(body.error).toBe('Cannot unlink the last account')
    })

    it('should return 400 when trying to unlink non-existent provider', async () => {
      const user = await auth.createUser({ name: 'Test User' })
      const sessionToken = await auth.createSession(user.id)

      // Link a different provider
      await auth.linkAccount({
        userId: user.id,
        provider: 'other-provider',
        providerAccountId: 'other-account-id',
      })

      const request = new Request('http://localhost/api/auth/unlink/mock', {
        method: 'POST',
      })
      request.headers.set('Cookie', `${SESSION_COOKIE_NAME}=${sessionToken}`)

      const response = await handleUnlink(request, auth, 'mock')

      expect(response.status).toBe(400)
      const body = await response.json<{ error: string }>()
      expect(body.error).toBe('Provider "mock" not linked to this account')
    })

    it('should clear email when unlinking account with email', async () => {
      const user = await auth.createUser({
        name: 'Test User',
        email: 'test@example.com',
        emailVerified: true,
      })
      const sessionToken = await auth.createSession(user.id)

      // Link two accounts
      await auth.linkAccount({
        userId: user.id,
        provider: 'mock',
        providerAccountId: 'mock-account-id',
      })
      await auth.linkAccount({
        userId: user.id,
        provider: 'other-provider',
        providerAccountId: 'other-account-id',
      })

      const request = new Request('http://localhost/api/auth/unlink/mock', {
        method: 'POST',
      })
      request.headers.set('Cookie', `${SESSION_COOKIE_NAME}=${sessionToken}`)

      const response = await handleUnlink(request, auth, 'mock')

      expect(response.status).toBe(200)

      // Verify email was cleared
      const updatedUser = await auth.getUser(user.id)
      expect(updatedUser?.email).toBeNull()
      expect(updatedUser?.emailVerified).toBe(false)
    })
  })
})
