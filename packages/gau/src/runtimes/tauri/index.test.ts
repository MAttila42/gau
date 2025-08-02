import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('esm-env', () => ({ BROWSER: true }))

const mockListen = vi.fn(() => Promise.resolve(() => {}))
vi.mock('@tauri-apps/api/event', () => ({ listen: mockListen }))

const mockPlatform = vi.fn(() => 'windows')
vi.mock('@tauri-apps/plugin-os', async () => ({
  platform: mockPlatform,
}))

const mockOpen = vi.fn()
vi.mock('@tauri-apps/plugin-shell', async () => ({
  open: mockOpen,
}))

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString() },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })
Object.defineProperty(globalThis, 'document', {
  value: { cookie: '' },
  writable: true,
})

describe('tauri runtime helpers', () => {
  let tauriHelpers: typeof import('./index')

  async function setup(isTauriEnv: boolean) {
    if (isTauriEnv) {
      // @ts-expect-error - mocking tauri env
      globalThis.window = { __TAURI_INTERNALS__: {} }
    }
    else {
      // @ts-expect-error - mocking browser env
      globalThis.window = {}
    }
    vi.resetModules()
    tauriHelpers = await import('./index')
  }

  beforeEach(() => {
    localStorageMock.clear()
    document.cookie = ''
  })

  afterEach(() => {
    vi.clearAllMocks()
    // @ts-expect-error - needs to be optional to be deleted
    delete globalThis.window
  })

  describe('isTauri', () => {
    it('should be true when __TAURI_INTERNALS__ is in window', async () => {
      await setup(true)
      expect(tauriHelpers.isTauri).toBe(true)
    })

    it('should be false when not in a Tauri environment', async () => {
      await setup(false)
      expect(tauriHelpers.isTauri).toBe(false)
    })
  })

  describe('with Tauri environment', () => {
    beforeEach(async () => {
      await setup(true)
    })

    describe('signInWithTauri', () => {
      it('should open the correct auth URL on desktop', async () => {
        mockPlatform.mockReturnValue('windows')
        await tauriHelpers.signInWithTauri('github', 'http://localhost:3000/api/auth', 'gau')
        expect(mockOpen).toHaveBeenCalledWith('http://localhost:3000/api/auth/github?redirectTo=gau%3A%2F%2Foauth%2Fcallback')
      })

      it('should use redirectOverride if provided', async () => {
        mockPlatform.mockReturnValue('windows')
        await tauriHelpers.signInWithTauri('github', 'http://localhost:3000/api/auth', 'gau', 'myapp://custom')
        expect(mockOpen).toHaveBeenCalledWith('http://localhost:3000/api/auth/github?redirectTo=myapp%3A%2F%2Fcustom')
      })

      it('should use origin for redirect on mobile platforms', async () => {
        mockPlatform.mockReturnValue('android')
        await tauriHelpers.signInWithTauri('google', 'https://server.com/api/auth')
        expect(mockOpen).toHaveBeenCalledWith('https://server.com/api/auth/google?redirectTo=https%3A%2F%2Fserver.com')
      })
    })

    describe('setupTauriListener', () => {
      it('should set up a listener for deep-links', async () => {
        const handler = vi.fn()
        await tauriHelpers.setupTauriListener(handler)
        expect(mockListen).toHaveBeenCalledWith('deep-link', expect.any(Function))
      })
    })

    describe('handleTauriDeepLink', () => {
      it('should call onToken with the token from a custom scheme URL', () => {
        const onToken = vi.fn()
        const url = 'gau://oauth/callback#token=test-token'
        tauriHelpers.handleTauriDeepLink(url, 'http://localhost:3000', 'gau', onToken)
        expect(onToken).toHaveBeenCalledWith('test-token')
      })

      it('should call onToken with the token from a base URL origin', () => {
        const onToken = vi.fn()
        const url = 'http://localhost:3000/#token=test-token-2'
        tauriHelpers.handleTauriDeepLink(url, 'http://localhost:3000', 'gau', onToken)
        expect(onToken).toHaveBeenCalledWith('test-token-2')
      })

      it('should not call onToken for an invalid URL', () => {
        const onToken = vi.fn()
        const url = 'http://another-site.com/#token=bad-token'
        tauriHelpers.handleTauriDeepLink(url, 'http://localhost:3000', 'gau', onToken)
        expect(onToken).not.toHaveBeenCalled()
      })
    })

    describe('token storage', () => {
      it('storeSessionToken should set localStorage and cookie', () => {
        tauriHelpers.storeSessionToken('my-secret-token')
        expect(localStorageMock.getItem('gau-token')).toBe('my-secret-token')
        expect(document.cookie).toBe('__gau-session-token=my-secret-token; path=/; max-age=31536000; samesite=lax')
      })

      it('getSessionToken should retrieve from localStorage', () => {
        localStorageMock.setItem('gau-token', 'my-retrieved-token')
        expect(tauriHelpers.getSessionToken()).toBe('my-retrieved-token')
      })

      it('clearSessionToken should remove from localStorage and expire cookie', () => {
        localStorageMock.setItem('gau-token', 'token-to-clear')
        document.cookie = '__gau-session-token=token-to-clear'
        tauriHelpers.clearSessionToken()
        expect(localStorageMock.getItem('gau-token')).toBeNull()
        expect(document.cookie).toBe('__gau-session-token=; path=/; max-age=0')
      })
    })
  })

  describe('without Tauri environment', () => {
    beforeEach(async () => {
      await setup(false)
    })

    it('signInWithTauri should not do anything', async () => {
      await tauriHelpers.signInWithTauri('github', 'http://localhost:3000')
      expect(mockOpen).not.toHaveBeenCalled()
    })

    it('setupTauriListener should not do anything', async () => {
      await tauriHelpers.setupTauriListener(vi.fn())
      expect(mockListen).not.toHaveBeenCalled()
    })
  })
})
