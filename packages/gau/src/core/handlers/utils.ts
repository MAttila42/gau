import type { Auth } from '../createAuth'
import { createOAuthUris } from '../../oauth/utils'
import {
  CALLBACK_URI_COOKIE_NAME,
  Cookies,
  CSRF_COOKIE_NAME,
  CSRF_MAX_AGE,
  LINKING_TOKEN_COOKIE_NAME,
  parseCookies,
  PKCE_COOKIE_NAME,
} from '../cookies'
import { json, redirect } from '../index'

export function verifyRequestOrigin(request: Request, trustHosts: 'all' | string[], development: boolean): boolean {
  if (trustHosts === 'all')
    return true

  const origin = request.headers.get('origin')

  if (!origin)
    return false

  let originHost: string
  try {
    originHost = new URL(origin).host
  }
  catch {
    return false
  }

  if (development) {
    const isLocal = originHost.startsWith('localhost') || originHost.startsWith('127.0.0.1')
    if (isLocal)
      return true
  }

  const requestUrl = new URL(request.url)
  const requestHost = requestUrl.host
  const requestOrigin = `${requestUrl.protocol}//${requestHost}`

  if (origin === requestOrigin)
    return true

  return trustHosts.includes(originHost)
}

export async function prepareOAuthRedirect(
  request: Request,
  auth: Auth,
  providerId: string,
  linkingToken: string | null,
): Promise<Response> {
  const provider = auth.providerMap.get(providerId)
  if (!provider)
    return json({ error: 'Provider not found' }, { status: 400 })

  const { state: originalState, codeVerifier } = createOAuthUris()
  const url = new URL(request.url)
  const redirectTo = url.searchParams.get('redirectTo')
  const profileName = url.searchParams.get('profile')

  if (redirectTo) {
    let parsedRedirect: URL
    try {
      if (redirectTo.startsWith('//'))
        throw new Error('Protocol-relative URL not allowed')
      parsedRedirect = new URL(redirectTo, url.origin)
    }
    catch {
      return json({ error: 'Invalid "redirectTo" URL' }, { status: 400 })
    }

    const redirectHost = parsedRedirect.host
    const currentHost = new URL(request.url).host

    const isSameHost = redirectHost === currentHost
    const isTrusted = auth.trustHosts === 'all' || auth.trustHosts.includes(redirectHost)
    const isHttp = parsedRedirect.protocol === 'http:' || parsedRedirect.protocol === 'https:'

    if (isHttp && !isSameHost && !isTrusted)
      return json({ error: 'Untrusted redirect host' }, { status: 400 })
  }

  const state = redirectTo ? `${originalState}.${btoa(redirectTo)}` : originalState
  let callbackUri = url.searchParams.get('callbackUri')
  if (!callbackUri && provider.requiresRedirectUri)
    callbackUri = `${url.origin}${auth.basePath}/${providerId}/callback`

  let scopesOverride: string[] | undefined
  if (profileName) {
    const providerProfiles = auth.profiles?.[providerId] ?? {}
    const selected = providerProfiles[profileName]
    if (!selected)
      return json({ error: `Unknown profile "${profileName}" for provider "${providerId}"` }, { status: 400 })
    if (selected.redirectUri)
      callbackUri = selected.redirectUri
    if (selected.scopes)
      scopesOverride = selected.scopes
  }

  let authUrl: URL | null
  try {
    authUrl = await provider.getAuthorizationUrl(state, codeVerifier, {
      redirectUri: callbackUri ?? undefined,
      scopes: scopesOverride,
    })
  }
  catch (error) {
    console.error('Error getting authorization URL:', error)
    authUrl = null
  }

  if (!authUrl)
    return json({ error: 'Could not create authorization URL' }, { status: 500 })

  const requestCookies = parseCookies(request.headers.get('Cookie'))
  const cookies = new Cookies(requestCookies, auth.cookieOptions)

  const temporaryCookieOptions = {
    maxAge: CSRF_MAX_AGE,
    sameSite: auth.development ? 'lax' : 'none',
    secure: !auth.development,
  } as const

  cookies.set(CSRF_COOKIE_NAME, originalState, temporaryCookieOptions)
  cookies.set(PKCE_COOKIE_NAME, codeVerifier, temporaryCookieOptions)
  if (linkingToken)
    cookies.set(LINKING_TOKEN_COOKIE_NAME, linkingToken, temporaryCookieOptions)

  if (callbackUri)
    cookies.set(CALLBACK_URI_COOKIE_NAME, callbackUri, temporaryCookieOptions)

  const redirectParam = url.searchParams.get('redirect')

  if (redirectParam === 'false') {
    const response = json({ url: authUrl.toString() })
    cookies.toHeaders().forEach((value, key) => {
      response.headers.append(key, value)
    })
    return response
  }

  const response = redirect(authUrl.toString())
  cookies.toHeaders().forEach((value, key) => {
    response.headers.append(key, value)
  })

  return response
}
