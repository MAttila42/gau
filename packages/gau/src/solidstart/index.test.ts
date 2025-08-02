import { describe, expect, it, vi } from 'vitest'
import { SolidAuth } from './index'

const mockAuth = {
  providerMap: new Map(),
} as any

vi.mock('../core', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../core')>()
  return {
    ...mod,
    createAuth: vi.fn(() => mockAuth),
    createHandler: vi.fn(() => (request: Request) => {
      return new Response(`Handled by core for ${request.method}`)
    }),
  }
})

describe('solidAuth', () => {
  it('should return GET, POST, and OPTIONS handlers', () => {
    const { GET, POST, OPTIONS } = SolidAuth({ providers: [] } as any)
    expect(GET).toBeInstanceOf(Function)
    expect(POST).toBeInstanceOf(Function)
    expect(OPTIONS).toBeInstanceOf(Function)
  })

  it('handlers should call the core handler', async () => {
    const { GET, POST, OPTIONS } = SolidAuth({ providers: [] } as any)
    const request = new Request('http://localhost/api/auth/github')
    const getResponse = await GET({ request })
    expect(await getResponse.text()).toBe('Handled by core for GET')

    const postResponse = await POST({ request: new Request('http://localhost/api/auth/github', { method: 'POST' }) })
    expect(await postResponse.text()).toBe('Handled by core for POST')

    const optionsResponse = await OPTIONS({ request: new Request('http://localhost/api/auth/github', { method: 'OPTIONS' }) })
    expect(await optionsResponse.text()).toBe('Handled by core for OPTIONS')
  })

  it('should accept an auth instance', () => {
    const authInstance = { providerMap: new Map(), signJWT: vi.fn() } as any
    const { GET } = SolidAuth(authInstance)
    expect(GET).toBeInstanceOf(Function)
  })
})
