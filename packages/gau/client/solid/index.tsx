import type { Accessor, ParentProps } from 'solid-js'
import type { User } from '../../core'
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

interface Session {
  user: User | null
}

interface AuthContextValue {
  session: Accessor<Session | null>
  signIn: (provider: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue>()

export function AuthProvider(props: ParentProps & { baseUrl: string, scheme?: string }) {
  const scheme = props.scheme ?? 'gau'

  const [session, { refetch }] = createResource<Session | null>(
    async () => {
      if (isServer)
        return null

      const token = getSessionToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined
      const res = await fetch(`${props.baseUrl}/session`, token ? { headers } : { credentials: 'include' })
      if (!res.ok)
        return null

      const contentType = res.headers.get('content-type')
      if (contentType?.includes('application/json'))
        return res.json()

      return null
    },
    { initialValue: null },
  )

  async function signIn(provider: string) {
    if (isTauri) {
      await signInWithTauri(provider, props.baseUrl, scheme)
    }
    else {
      const authUrl = `${props.baseUrl}/${provider}`
      window.location.href = authUrl
    }
  }

  const signOut = async () => {
    clearSessionToken()
    const token = getSessionToken()
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    await fetch(`${props.baseUrl}/signout`, token ? { method: 'POST', headers } : { method: 'POST', credentials: 'include' })
    refetch()
  }

  onMount(() => {
    if (!isTauri)
      return

    setupTauriListener(async (url) => {
      handleTauriDeepLink(url, props.baseUrl, scheme, (token) => {
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

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context)
    throw new Error('useAuth must be used within an AuthProvider')
  return context
}
