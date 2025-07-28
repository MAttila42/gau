import type { Accessor, ParentProps } from 'solid-js'
import type { GauSession, ProviderIds } from '../../core'
import { createContext, createResource, onMount, useContext } from 'solid-js'
import { isServer } from 'solid-js/web'

import {
  clearSessionToken,
  getSessionToken,
  handleTauriDeepLink,
  isTauri,
  setupTauriListener,
  signInWithTauri,
  storeSessionToken,
} from '../../runtimes/tauri'

interface AuthContextValue<TAuth = unknown> {
  session: Accessor<GauSession | null>
  signIn: (provider: ProviderIds<TAuth>, options?: { redirectTo?: string }) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<any>()

export function AuthProvider<const TAuth = unknown>(props: ParentProps & { auth?: TAuth, baseUrl?: string, scheme?: string, redirectTo?: string }) {
  const scheme = props.scheme ?? 'gau'
  const baseUrl = props.baseUrl ?? '/api/auth'

  const [session, { refetch }] = createResource<GauSession | null>(
    async () => {
      if (isServer)
        return null

      const token = getSessionToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined
      const res = await fetch(`${baseUrl}/session`, token ? { headers } : { credentials: 'include' })
      if (!res.ok)
        return { user: null, session: null }

      const contentType = res.headers.get('content-type')
      if (contentType?.includes('application/json'))
        return res.json()

      return { user: null, session: null }
    },
    { initialValue: null },
  )

  async function signIn(provider: ProviderIds<TAuth>, { redirectTo }: { redirectTo?: string } = {}) {
    let finalRedirectTo = redirectTo ?? props.redirectTo
    if (isTauri) {
      await signInWithTauri(provider as string, baseUrl, scheme, finalRedirectTo)
    }
    else {
      if (!finalRedirectTo && !isServer)
        finalRedirectTo = window.location.origin

      const query = finalRedirectTo ? `?redirectTo=${encodeURIComponent(finalRedirectTo)}` : ''
      const authUrl = `${baseUrl}/${provider as string}${query}`
      window.location.href = authUrl
    }
  }

  const signOut = async () => {
    clearSessionToken()
    const token = getSessionToken()
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    await fetch(`${baseUrl}/signout`, token ? { method: 'POST', headers } : { method: 'POST', credentials: 'include' })
    refetch()
  }

  onMount(() => {
    if (!isTauri) {
      const hash = new URL(window.location.href).hash.substring(1)
      const params = new URLSearchParams(hash)
      const tokenParam = params.get('token')
      if (tokenParam) {
        storeSessionToken(tokenParam)
        refetch()
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }
    }

    if (!isTauri)
      return

    setupTauriListener(async (url) => {
      handleTauriDeepLink(url, baseUrl, scheme, (token) => {
        storeSessionToken(token)
        refetch()
      })
    })
  })

  return (
    <AuthContext.Provider value={{ session, signIn, signOut }}>
      {props.children}
    </AuthContext.Provider>
  )
}

export function useAuth<const TAuth = unknown>(): AuthContextValue<TAuth> {
  const context = useContext(AuthContext)
  if (!context)
    throw new Error('useAuth must be used within an AuthProvider')
  return context as AuthContextValue<TAuth>
}
