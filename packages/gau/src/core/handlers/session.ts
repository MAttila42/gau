import type { Auth } from '../createAuth'
import { parseCookies, SESSION_COOKIE_NAME } from '../cookies'
import { json, NULL_SESSION } from '../index'

export async function handleSession(request: Request, auth: Auth): Promise<Response> {
  const rawCookieHeader = request.headers.get('Cookie')
  const requestCookies = parseCookies(rawCookieHeader)
  let sessionToken = requestCookies.get(SESSION_COOKIE_NAME)

  if (!sessionToken) {
    const authHeader = request.headers.get('Authorization')
    if (authHeader?.startsWith('Bearer '))
      sessionToken = authHeader.substring(7)
  }

  const providers = Array.from(auth.providerMap.keys())

  if (!sessionToken)
    return json({ ...NULL_SESSION, providers })

  try {
    const sessionData = await auth.validateSession(sessionToken)

    if (!sessionData)
      return json({ ...NULL_SESSION, providers }, { status: 401 })

    return json({ ...sessionData, providers })
  }
  catch (error) {
    console.error('Error validating session:', error)
    return json({ error: 'Failed to validate session' }, { status: 500 })
  }
}
