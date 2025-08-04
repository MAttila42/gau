import type { Auth } from '../createAuth'
import type { RequestLike, ResponseLike } from '../index'
import { Cookies, parseCookies, SESSION_COOKIE_NAME } from '../cookies'

import { json } from '../index'
import { prepareOAuthRedirect } from './utils'

export async function handleSignIn(request: RequestLike, auth: Auth, providerId: string): Promise<ResponseLike> {
  return prepareOAuthRedirect(request, auth, providerId, null)
}

export async function handleSignOut(request: RequestLike, auth: Auth): Promise<ResponseLike> {
  const requestCookies = parseCookies(request.headers.get('Cookie'))
  const cookies = new Cookies(requestCookies, auth.cookieOptions)
  cookies.delete(SESSION_COOKIE_NAME, {
    sameSite: auth.development ? 'lax' : 'none',
    secure: !auth.development,
  })

  const response = json({ message: 'Signed out' })
  cookies.toHeaders().forEach((value, key) => {
    response.headers.append(key, value)
  })

  return response
}
