import type { Accessor, JSXElement, ParentProps, VoidComponent } from 'solid-js'
import type { GauSession, ProviderIds } from '../../core'
import { createContext, createResource, onCleanup, onMount, Show, untrack, useContext } from 'solid-js'
import { isServer } from 'solid-js/web'
import { NULL_SESSION } from '../../core'
import { handleTauriDeepLink, isTauri, linkAccountWithTauri, setupTauriListener, signInWithTauri } from '../../runtimes/tauri'
import { clearSessionToken, getSessionToken, storeSessionToken } from '../token'

interface AuthContextValue<TAuth = unknown> {
  session: Accessor<GauSession<ProviderIds<TAuth>>>
  signIn: (provider: ProviderIds<TAuth>, options?: { redirectTo?: string }) => Promise<void>
  linkAccount: (provider: ProviderIds<TAuth>, options?: { redirectTo?: string }) => Promise<void>
  unlinkAccount: (provider: ProviderIds<TAuth>) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<any>()

export function AuthProvider<const TAuth = unknown>(props: ParentProps & { auth?: TAuth, baseUrl?: string, scheme?: string, redirectTo?: string }) {
  const scheme = untrack(() => props.scheme ?? 'gau')
  const baseUrl = untrack(() => props.baseUrl ?? '/api/auth')

  const fetchSession = async (): Promise<GauSession<ProviderIds<TAuth>>> => {
    if (isServer)
      return { ...NULL_SESSION, providers: [] }

    const token = getSessionToken()
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    const res = await fetch(`${baseUrl}/session`, token ? { headers } : { credentials: 'include' })

    const contentType = res.headers.get('content-type')
    if (contentType?.includes('application/json'))
      return res.json()

    return { ...NULL_SESSION, providers: [] as ProviderIds<TAuth>[] }
  }

  const [session, { refetch }] = createResource<GauSession<ProviderIds<TAuth>>>(
    fetchSession,
    { initialValue: { ...NULL_SESSION, providers: [] } },
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

  async function linkAccount(provider: ProviderIds<TAuth>, { redirectTo }: { redirectTo?: string } = {}) {
    if (isTauri) {
      await linkAccountWithTauri(provider as string, baseUrl, scheme, redirectTo)
      return
    }

    let finalRedirectTo = redirectTo ?? props.redirectTo
    if (!finalRedirectTo && !isServer)
      finalRedirectTo = window.location.href

    const query = finalRedirectTo ? `?redirectTo=${encodeURIComponent(finalRedirectTo)}` : ''
    const linkUrl = `${baseUrl}/link/${provider as string}${query}${query ? '&' : '?'}redirect=false`

    const token = getSessionToken()

    const fetchOptions: RequestInit = token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : { credentials: 'include' }

    const res = await fetch(linkUrl, fetchOptions)
    if (res.redirected) {
      window.location.href = res.url
    }
    else {
      const data = await res.json()
      if (data.url)
        window.location.href = data.url
    }
  }

  async function unlinkAccount(provider: ProviderIds<TAuth>) {
    const token = getSessionToken()
    const fetchOptions: RequestInit = token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : { credentials: 'include' }

    const res = await fetch(`${baseUrl}/unlink/${provider as string}`, {
      method: 'POST',
      ...fetchOptions,
    })

    if (res.ok)
      refetch()
    else
      console.error('Failed to unlink account', await res.json())
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

    let disposed = false
    setupTauriListener(async (url) => {
      handleTauriDeepLink(url, baseUrl, scheme, (token) => {
        storeSessionToken(token)
        refetch()
      })
    }).then((unlisten) => {
      if (disposed)
        unlisten?.()
      else if (unlisten)
        onCleanup(() => unlisten())
    })
    onCleanup(() => {
      disposed = true
    })
  })

  return (
    <AuthContext.Provider value={{ session, signIn, linkAccount, unlinkAccount, signOut }}>
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

export function Protected<const TAuth = unknown>(
  page: (session: Accessor<GauSession<ProviderIds<TAuth>>>) => JSXElement,
  fallbackOrRedirect?: (() => JSXElement) | string,
): VoidComponent {
  return () => {
    const auth = useAuth<TAuth>()

    const isRedirectMode = typeof fallbackOrRedirect === 'string' || fallbackOrRedirect === undefined
    const redirectTo = isRedirectMode ? (fallbackOrRedirect ?? '/') : undefined
    const Fallback = !isRedirectMode ? (fallbackOrRedirect as (() => JSXElement)) : undefined

    onMount(() => {
      if (isRedirectMode && !auth.session().user && !isServer && redirectTo)
        window.location.href = redirectTo
    })

    return (
      <Show when={auth.session().user} fallback={Fallback ? <Fallback /> : undefined}>
        {page(auth.session)}
      </Show>
    )
  }
}
