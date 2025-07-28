import { listen } from '@tauri-apps/api/event'
import { BROWSER } from 'esm-env'

export const isTauri = BROWSER && '__TAURI_INTERNALS__' in window

export async function signInWithTauri(
  provider: string,
  baseUrl: string,
  scheme: string = 'gau',
  redirectOverride?: string,
) {
  if (!isTauri)
    return

  const { platform } = await import('@tauri-apps/plugin-os')
  const { open } = await import('@tauri-apps/plugin-shell')

  const currentPlatform = platform()
  let redirectTo: string

  if (redirectOverride)
    redirectTo = redirectOverride

  else if (currentPlatform === 'android' || currentPlatform === 'ios')
    redirectTo = new URL(baseUrl).origin

  else
    redirectTo = `${scheme}://oauth/callback`

  const authUrl = `${baseUrl}/${provider}?redirectTo=${encodeURIComponent(redirectTo)}`
  await open(authUrl)
}

export function setupTauriListener(handler: (url: string) => Promise<void>) {
  if (!isTauri)
    return

  listen<string>('deep-link', async (event) => {
    await handler(event.payload)
  }).catch(console.error)
}

export function handleTauriDeepLink(url: string, baseUrl: string, scheme: string, onToken: (token: string) => void) {
  const parsed = new URL(url)
  if (parsed.protocol !== `${scheme}:` && parsed.origin !== new URL(baseUrl).origin)
    return

  const params = new URLSearchParams(parsed.hash.substring(1))
  const token = params.get('token')
  if (token)
    onToken(token)
}

export function storeSessionToken(token: string) {
  if (!BROWSER)
    return
  try {
    localStorage.setItem('gau-token', token)
    document.cookie = `__gau-session-token=${token}; path=/; max-age=31536000; samesite=lax`
  }
  catch {}
}

export function getSessionToken(): string | null {
  if (!BROWSER)
    return null
  return localStorage.getItem('gau-token')
}

export function clearSessionToken() {
  if (!BROWSER)
    return
  try {
    localStorage.removeItem('gau-token')
    document.cookie = `__gau-session-token=; path=/; max-age=0`
  }
  catch {}
}
