import type { GauSession, ProviderIds } from '../../core'
import { BROWSER } from 'esm-env'
import { getContext, setContext } from 'svelte'
import { handleTauriDeepLink, isTauri, setupTauriListener, signInWithTauri } from '../../runtimes/tauri'
import { clearSessionToken, getSessionToken, storeSessionToken } from '../token'

interface AuthContextValue<TAuth = unknown> {
  session: GauSession | null
  signIn: (provider: ProviderIds<TAuth>, options?: { redirectTo?: string }) => Promise<void>
  signOut: () => Promise<void>
}

const AUTH_CONTEXT_KEY = Symbol('gau-auth')

export function createSvelteAuth<const TAuth = unknown>({
  baseUrl = '/api/auth',
  scheme = 'gau',
  redirectTo: defaultRedirectTo,
}: {
  baseUrl?: string
  scheme?: string
  redirectTo?: string
} = {}) {
  let session = $state<GauSession | null>(null)

  async function fetchSession() {
    if (!BROWSER) {
      session = null
      return
    }

    const token = getSessionToken()
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    const res = await fetch(`${baseUrl}/session`, token ? { headers } : { credentials: 'include' })

    if (!res.ok) {
      session = { user: null, session: null }
      return
    }

    const contentType = res.headers.get('content-type')
    if (contentType?.includes('application/json'))
      session = await res.json()
    else
      session = { user: null, session: null }
  }

  async function signIn(provider: ProviderIds<TAuth>, { redirectTo }: { redirectTo?: string } = {}) {
    let finalRedirectTo = redirectTo ?? defaultRedirectTo
    if (isTauri) {
      await signInWithTauri(provider as string, baseUrl, scheme, finalRedirectTo)
    }
    else {
      if (!finalRedirectTo && BROWSER)
        finalRedirectTo = window.location.origin

      const query = finalRedirectTo ? `?redirectTo=${encodeURIComponent(finalRedirectTo)}` : ''
      window.location.href = `${baseUrl}/${provider as string}${query}`
    }
  }

  async function signOut() {
    clearSessionToken()
    const token = getSessionToken()
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    await fetch(`${baseUrl}/signout`, token ? { method: 'POST', headers } : { method: 'POST', credentials: 'include' })
    await fetchSession()
  }

  if (BROWSER) {
    const hash = new URL(window.location.href).hash.substring(1)
    const params = new URLSearchParams(hash)
    const tokenFromUrl = params.get('token')

    if (tokenFromUrl) {
      storeSessionToken(tokenFromUrl)
      void (async () => {
        try {
          // @ts-expect-error - SvelteKit-only
          const { replaceState } = await import('$app/navigation')
          await replaceState(window.location.pathname + window.location.search, {})
        }
        catch {
          window.history.replaceState(null, '', window.location.pathname + window.location.search)
        }
        await fetchSession()
      })()
    }
    else {
      fetchSession()
    }

    if (isTauri) {
      setupTauriListener(async (url) => {
        handleTauriDeepLink(url, baseUrl, scheme, async (token) => {
          storeSessionToken(token)
          await fetchSession()
        })
      })
    }
  }

  const contextValue: AuthContextValue<TAuth> = {
    get session() {
      return session
    },
    signIn: signIn as (provider: ProviderIds<TAuth>, options?: { redirectTo?: string }) => Promise<void>,
    signOut,
  }

  setContext(AUTH_CONTEXT_KEY, contextValue)
}

export function useAuth<const TAuth = unknown>(): AuthContextValue<TAuth> {
  const context = getContext<AuthContextValue<TAuth>>(AUTH_CONTEXT_KEY)
  if (!context)
    throw new Error('useAuth must be used within an AuthProvider')

  return context
}
