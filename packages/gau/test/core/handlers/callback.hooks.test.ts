import type { Auth } from '../../../src/core/createAuth'
import type { OAuthProvider } from '../../../src/oauth'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryAdapter } from '../../../src/adapters'
import { CALLBACK_URI_COOKIE_NAME, CSRF_COOKIE_NAME, PKCE_COOKIE_NAME } from '../../../src/core/cookies'
import { createAuth } from '../../../src/core/createAuth'
import { handleCallback } from '../../../src/core/handlers/callback'

function makeProvider(overrides: Partial<OAuthProvider<'mock'>> = {}): OAuthProvider<'mock'> {
  const base: OAuthProvider<'mock'> = {
    id: 'mock',
    requiresRedirectUri: true,
    getAuthorizationUrl: vi.fn().mockResolvedValue(new URL('https://provider.com/auth')),
    validateCallback: vi.fn().mockResolvedValue({
      user: { id: 'provider-user-id', name: 'Provider User', email: 'user@provider.com', emailVerified: true, avatar: 'https://avatar.url', raw: {} },
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
  return { ...base, ...overrides }
}

function makeRequest(state = 'state123', opts: { redirectFalse?: boolean } = {}) {
  const url = new URL(`http://localhost/api/auth/mock/callback`)
  url.searchParams.set('code', 'code123')
  url.searchParams.set('state', state)
  if (opts.redirectFalse)
    url.searchParams.set('redirect', 'false')
  const req = new Request(url.toString())
  req.headers.set('Cookie', `${CSRF_COOKIE_NAME}=${state}; ${PKCE_COOKIE_NAME}=pkce; ${CALLBACK_URI_COOKIE_NAME}=uri`)
  return req
}

describe('callback hooks', () => {
  let auth: Auth
  let provider: OAuthProvider<'mock'>

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('onOAuthExchange can short-circuit with a custom response', async () => {
    const adapter = MemoryAdapter()
    provider = makeProvider()
    auth = createAuth({
      adapter,
      providers: [provider],
      jwt: { secret: 'test', algorithm: 'HS256' },
      onOAuthExchange: vi.fn(async () => ({ handled: true as const, response: new Response(JSON.stringify({ ok: true }), { status: 201, headers: { 'Content-Type': 'application/json' } }) })),
    })

    const req = makeRequest()
    const res = await handleCallback(req, auth, 'mock')
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({ ok: true })

    const u = await auth.getUserByAccount('mock', 'provider-user-id')
    expect(u).toBeNull()

    expect((auth.onOAuthExchange as any)).toHaveBeenCalledTimes(1)
  })

  it('mapExternalProfile maps provider user before persistence', async () => {
    const adapter = MemoryAdapter()
    provider = makeProvider()
    auth = createAuth({
      adapter,
      providers: [provider],
      jwt: { secret: 'test', algorithm: 'HS256' },
      mapExternalProfile: vi.fn(async () => ({
        name: 'Mapped Name',
        email: 'mapped@example.com',
        emailVerified: true,
        avatar: 'https://mapped.example/avatar.png',
      })),
    })

    const req = makeRequest('state456', { redirectFalse: true })
    const res = await handleCallback(req, auth, 'mock')
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.user.name).toBe('Mapped Name')
    expect(json.user.email).toBe('mapped@example.com')
    expect(json.user.emailVerified).toBe(true)
    expect(json.user.image).toBe('https://mapped.example/avatar.png')

    expect((auth.mapExternalProfile as any)).toHaveBeenCalledTimes(1)
  })

  it('enforces linkOnlyProviders by blocking sign-in', async () => {
    const adapter = MemoryAdapter()
    provider = makeProvider()
    auth = createAuth({
      adapter,
      providers: [provider],
      jwt: { secret: 'test', algorithm: 'HS256' },
      linkOnlyProviders: ['mock'],
    })

    const req = makeRequest('state789')
    const res = await handleCallback(req, auth, 'mock')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/Sign-in with this provider is disabled/i)

    const u = await auth.getUserByAccount('mock', 'provider-user-id')
    expect(u).toBeNull()
  })

  it('onBeforeLinkAccount can block linking with custom response', async () => {
    const adapter = MemoryAdapter()
    provider = makeProvider()
    const onBefore = vi.fn(async () => ({ allow: false as const, response: new Response('blocked', { status: 418 }) }))
    auth = createAuth({
      adapter,
      providers: [provider],
      jwt: { secret: 'test', algorithm: 'HS256' },
      onBeforeLinkAccount: onBefore,
    })

    const req = makeRequest('state999')
    const res = await handleCallback(req, auth, 'mock')
    expect(res.status).toBe(418)
    const text = await res.text()
    expect(text).toBe('blocked')

    expect(onBefore).toHaveBeenCalledTimes(1)

    const u = await auth.getUserByAccount('mock', 'provider-user-id')
    expect(u).toBeNull()
  })

  it('onBeforeLinkAccount without response returns 403 and does not link', async () => {
    const adapter = MemoryAdapter()
    provider = makeProvider()
    const onBefore = vi.fn(async () => ({ allow: false as const }))
    auth = createAuth({
      adapter,
      providers: [provider],
      jwt: { secret: 'test', algorithm: 'HS256' },
      onBeforeLinkAccount: onBefore,
    })

    const req = makeRequest('state1000')
    const res = await handleCallback(req, auth, 'mock')
    expect(res.status).toBe(403)

    const u = await auth.getUserByAccount('mock', 'provider-user-id')
    expect(u).toBeNull()
  })

  it('onAfterLinkAccount fires after link and update', async () => {
    const adapter = MemoryAdapter()
    provider = makeProvider()
    const onAfter = vi.fn(async () => {})

    auth = createAuth({
      adapter,
      providers: [provider],
      jwt: { secret: 'test', algorithm: 'HS256' },
      onAfterLinkAccount: onAfter,
    })

    const req1 = makeRequest('st-link')
    const res1 = await handleCallback(req1, auth, 'mock')
    expect([200, 302]).toContain(res1.status)

    expect(onAfter).toHaveBeenNthCalledWith(1, expect.objectContaining({ action: 'link' }))

    const req2 = makeRequest('st-update')
    const res2 = await handleCallback(req2, auth, 'mock')
    expect([200, 302]).toContain(res2.status)

    expect(onAfter).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'update' }))
  })
})
