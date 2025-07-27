import type { Handle, RequestEvent } from '@sveltejs/kit'
import type { CreateAuthOptions, Session, User } from '../core'
import type { OAuthProvider } from '../oauth'
import { createAuth, createHandler, parseCookies, SESSION_COOKIE_NAME } from '../core'

type AuthInstance<TProviders extends OAuthProvider<any>[]> = ReturnType<typeof createAuth<TProviders>>

/**
 * Creates GET and POST handlers for SvelteKit.
 *
 * @example
 * ```ts
 * // src/routes/api/auth/[...gau]/+server.ts
 * import { SvelteKitAuth } from '@rttnd/gau/sveltekit'
 * import { auth } from '$lib/server/auth'
 *
 * export const { GET, POST } = SvelteKitAuth(auth)
 * ```
 */
export function SvelteKitAuth<const TProviders extends OAuthProvider<any>[]>(optionsOrAuth: CreateAuthOptions<TProviders> | AuthInstance<TProviders>) {
  // TODO: Duck-type to check if we have an instance or raw options
  const isInstance = 'providerMap' in optionsOrAuth && 'signJWT' in optionsOrAuth

  const auth = isInstance
    ? (optionsOrAuth as AuthInstance<TProviders>)
    : createAuth(optionsOrAuth as CreateAuthOptions<TProviders>)

  const handler = createHandler(auth)
  const sveltekitHandler = (event: RequestEvent) => handler(event.request)

  const handle: Handle = async ({ event, resolve }) => {
    (event.locals as any).getSession = async (): Promise<{
      user: User
      session: Session
    } | null> => {
      const requestCookies = parseCookies(event.request.headers.get('Cookie'))
      let sessionToken = requestCookies.get(SESSION_COOKIE_NAME)

      if (!sessionToken) {
        const authHeader = event.request.headers.get('Authorization')
        if (authHeader?.startsWith('Bearer '))
          sessionToken = authHeader.substring(7)
      }

      if (!sessionToken)
        return null

      try {
        return await auth.validateSession(sessionToken)
      }
      catch {
        return null
      }
    }
    return resolve(event)
  }

  return {
    GET: sveltekitHandler,
    POST: sveltekitHandler,
    OPTIONS: sveltekitHandler,
    handle,
  }
}
