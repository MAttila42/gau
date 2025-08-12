import type { CreateAuthOptions, GauSession, ProviderIds } from '../core'
import type { OAuthProvider } from '../oauth'
import process from 'node:process'
import { createAuth, createHandler, NULL_SESSION, parseCookies, SESSION_COOKIE_NAME } from '../core'

type AuthInstance<TProviders extends OAuthProvider<any>[]> = ReturnType<typeof createAuth<TProviders>>

/**
 * Creates GET and POST handlers for SolidStart.
 *
 * @example
 * ```ts
 * // src/routes/api/auth/[...auth].ts
 * import { SolidAuth } from '@rttnd/gau/solid-start'
 * import { authOptions } from '~/server/auth'
 *
 * export const { GET, POST } = SolidAuth(authOptions)
 * ```
 */
export function SolidAuth<const TProviders extends OAuthProvider<any>[]>(optionsOrAuth: CreateAuthOptions<TProviders> | AuthInstance<TProviders>) {
  // TODO: Duck-type to check if we have an instance or raw options
  const isInstance = 'providerMap' in optionsOrAuth && 'signJWT' in optionsOrAuth

  const auth = isInstance
    ? (optionsOrAuth as AuthInstance<TProviders>)
    : createAuth(optionsOrAuth as CreateAuthOptions<TProviders>)

  auth.development = process.env.NODE_ENV === 'development'

  const handler = createHandler(auth)
  const solidHandler = (event: any) => handler(event.request)
  return {
    GET: solidHandler,
    POST: solidHandler,
    OPTIONS: solidHandler,
  }
}

/**
 * Creates a SolidStart-compatible getSession resolver to validate a session from a Request.
 * This mirrors the SvelteKit integration behaviour and supports both Cookie and Authorization headers.
 */
export function createSolidStartGetSession<const TProviders extends OAuthProvider<any>[]>(auth: AuthInstance<TProviders>) {
  return async function getSessionFromRequest(
    request: Request,
  ): Promise<GauSession<ProviderIds<AuthInstance<TProviders>>>> {
    const requestCookies = parseCookies(request.headers.get('Cookie'))
    let sessionToken = requestCookies.get(SESSION_COOKIE_NAME)

    if (!sessionToken) {
      const authHeader = request.headers.get('Authorization')
      if (authHeader?.startsWith('Bearer '))
        sessionToken = authHeader.substring(7)
    }

    const providers = Array.from(auth.providerMap.keys()) as ProviderIds<AuthInstance<TProviders>>[]

    if (!sessionToken)
      return { ...NULL_SESSION, providers }

    try {
      const validated = await auth.validateSession(sessionToken)
      if (!validated)
        return { ...NULL_SESSION, providers }

      return { ...validated, providers }
    }
    catch {
      return { ...NULL_SESSION, providers }
    }
  }
}

/**
 * SolidStart middleware factory to attach `locals.getSession` and optionally preload the session.
 *
 * Usage:
 *   onRequest: [authMiddleware(true, auth)]
 *   onRequest: [authMiddleware(['/protected', '/dashboard'], auth)]
 *   onRequest: [authMiddleware(false, auth)]
 */
export function authMiddleware<const TProviders extends OAuthProvider<any>[]>(
  pathsToPreLoad: string[] | boolean,
  optionsOrAuth: CreateAuthOptions<TProviders> | AuthInstance<TProviders>,
) {
  const isInstance = 'providerMap' in optionsOrAuth && 'signJWT' in optionsOrAuth
  const auth = isInstance
    ? (optionsOrAuth as AuthInstance<TProviders>)
    : createAuth(optionsOrAuth as CreateAuthOptions<TProviders>)

  const getSessionFromRequest = createSolidStartGetSession(auth)

  return async (event: any) => {
    const url = new URL(event.request.url)
    const shouldPreload = typeof pathsToPreLoad === 'boolean'
      ? pathsToPreLoad
      : pathsToPreLoad.includes(url.pathname)

    if (shouldPreload) {
      const preloaded = await getSessionFromRequest(event.request)
      event.locals.getSession = async () => preloaded
      return
    }

    event.locals.getSession = () => getSessionFromRequest(event.request)
  }
}
