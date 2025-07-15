import type { User } from '../../core'
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

interface Session {
  user: User | null
}

export function createSvelteAuth(options: { baseUrl: string, scheme?: string }) {
  const { baseUrl, scheme = 'gau' } = options
  let session = $state<Session | null>(null)

  async function fetchSession() {
    if (!BROWSER) {
      session = null
      return
    }

    const token = getSessionToken()
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    const res = await fetch(`${baseUrl}/session`, token ? { headers } : { credentials: 'include' })

    if (!res.ok) {
      session = { user: null }
      return
    }

    const contentType = res.headers.get('content-type')
    if (contentType?.includes('application/json'))
      session = await res.json()
    else
      session = { user: null }
  }

  async function signIn(provider: string) {
    if (isTauri)
      await signInWithTauri(provider, baseUrl, scheme)
    else
      window.location.href = `${baseUrl}/${provider}`
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
    signIn,
    signOut,
  }
}
