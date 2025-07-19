import type { Handle, RequestEvent } from '@sveltejs/kit'
import type { CreateAuthOptions } from '../core'
import { createAuth, createHandler, parseCookies, SESSION_COOKIE_NAME } from '../core'

type AuthInstance = ReturnType<typeof createAuth>

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
export function SvelteKitAuth(optionsOrAuth: CreateAuthOptions | AuthInstance) {
  // TODO: Duck-type to check if we have an instance or raw options
  const isInstance = 'providerMap' in optionsOrAuth && 'signJWT' in optionsOrAuth

  const auth = isInstance
    ? (optionsOrAuth as AuthInstance)
    : createAuth(optionsOrAuth as CreateAuthOptions)

  const handler = createHandler(auth)
  const sveltekitHandler = (event: RequestEvent) => handler(event.request)

  const handle: Handle = async ({ event, resolve }) => {
    (event.locals as any).getSession = async () => {
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
