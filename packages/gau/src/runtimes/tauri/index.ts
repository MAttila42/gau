import { BROWSER } from 'esm-env'
import { getSessionToken } from '../../client/token'

export const isTauri = BROWSER && '__TAURI_INTERNALS__' in (globalThis as any)

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

  const currentPlatform = platform() // platform is NO LONGER an async function
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

export async function setupTauriListener(
  handler: (url: string) => Promise<void>,
): Promise<(() => void) | void> {
  if (!isTauri)
    return

  const { listen } = await import('@tauri-apps/api/event')
  try {
    const unlisten = await listen<string>('deep-link', async (event) => {
      await handler(event.payload)
    })
    return unlisten
  }
  catch (err) {
    console.error(err)
  }
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

export async function linkAccountWithTauri(
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

  const token = getSessionToken()
  if (!token) {
    console.error('No session token found, cannot link account.')
    return
  }

  const query = `?redirectTo=${encodeURIComponent(redirectTo)}&token=${encodeURIComponent(token)}`
  const linkUrl = `${baseUrl}/link/${provider}${query}`
  await open(linkUrl)
}
