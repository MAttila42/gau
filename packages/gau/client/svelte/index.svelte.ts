import type { GauSession, ProviderIds } from '../../core'
import { BROWSER } from 'esm-env'

import {
  clearSessionToken,
  getSessionToken,
  handleTauriDeepLink,
  isTauri,
  setupTauriListener,
  signInWithTauri,
  storeSessionToken,
} from '../../runtimes/tauri'

export function createSvelteAuth<const TAuth = unknown>({
  baseUrl = '/api/auth',
  scheme = 'gau',
}: { baseUrl?: string, scheme?: string } = {}) {
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
    if (isTauri) {
      await signInWithTauri(provider as string, baseUrl, scheme, redirectTo)
    }
    else {
      const query = redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''
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
    fetchSession()
    if (isTauri) {
      setupTauriListener(async (url) => {
        handleTauriDeepLink(url, baseUrl, scheme, (token) => {
          storeSessionToken(token)
          fetchSession()
        })
      })
    }
  }

  return {
    get session() {
      return session
    },
    signIn: signIn as (provider: ProviderIds<TAuth>, options?: { redirectTo?: string }) => Promise<void>,
    signOut,
  }
}
