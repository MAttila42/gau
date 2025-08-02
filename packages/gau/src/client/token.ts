import { BROWSER } from 'esm-env'

export function storeSessionToken(token: string) {
  if (!BROWSER)
    return
  try {
    localStorage.setItem('gau-token', token)
    document.cookie = `__gau-session-token=${token}; path=/; max-age=31536000; samesite=lax; secure`
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
