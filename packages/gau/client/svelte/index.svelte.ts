import type { User } from '../../core'
import { listen } from '@tauri-apps/api/event'
import { BROWSER } from 'esm-env'

interface Session {
  user: User | null
}

export function createSvelteAuth(options: { baseUrl: string }) {
  const { baseUrl } = options
  let session = $state<Session | null>(null)

  function getStoredToken() {
    if (!BROWSER)
      return null
    return localStorage.getItem('gau-token')
  }

  function storeToken(token: string) {
    if (!BROWSER)
      return
    try {
      localStorage.setItem('gau-token', token)
    }
    catch {}
  }

  function clearToken() {
    if (!BROWSER)
      return
    try {
      localStorage.removeItem('gau-token')
      document.cookie = '__gau-session-token=; path=/; max-age=0'
    }
    catch {}
  }

  async function fetchSession() {
    if (!BROWSER) {
      session = null
      return
    }

    const token = getStoredToken()
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

  const isTauri = BROWSER && (window as any).__TAURI__

  async function signIn(provider: string) {
    if (isTauri) {
      const { platform } = await import('@tauri-apps/plugin-os')
      const { open } = await import('@tauri-apps/plugin-shell')
      const currentPlatform = platform()
      let redirectTo: string
      if (currentPlatform === 'android' || currentPlatform === 'ios')
        redirectTo = encodeURIComponent('https://the-stack.hegyi-aron101.workers.dev')
      else
        redirectTo = encodeURIComponent('the-stack://oauth/callback')

      const authUrl = `${baseUrl}/${provider}?redirectTo=${redirectTo}`
      await open(authUrl)
    }
    else {
      window.location.href = `${baseUrl}/${provider}`
    }
  }

  async function signOut() {
    clearToken()
    const token = getStoredToken()
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined
    await fetch(`${baseUrl}/signout`, token ? { method: 'POST', headers } : { method: 'POST', credentials: 'include' })
    await fetchSession()
  }

  async function handleDeepLink(url: string) {
    const parsed = new URL(url)
    if (parsed.protocol !== 'the-stack:' && (parsed.protocol !== 'https' || !parsed.host.endsWith('the-stack.hegyi-aron101.workers.dev')))
      return

    const token = parsed.searchParams.get('token')
    if (token) {
      storeToken(token)
      document.cookie = `__gau-session-token=${token}; path=/; max-age=31536000; samesite=lax`
      await fetchSession()
    }
  }

  if (BROWSER) {
    fetchSession()
    if (isTauri) {
      listen<string>('deep-link', async (event) => {
        await handleDeepLink(event.payload)
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
