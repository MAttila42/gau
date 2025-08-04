import type { Handle, RequestEvent } from '@sveltejs/kit'
import type { CreateAuthOptions, GauSession, ProviderIds } from '../core'
import type { OAuthProvider } from '../oauth'
import { createAuth, createHandler, NULL_SESSION, parseCookies, SESSION_COOKIE_NAME } from '../core'

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

  void (async () => {
    try {
      auth.development = (await import('$app/environment')).dev
    }
    catch {
      auth.development = false
    }
  })()

  const handler = createHandler(auth)
  const sveltekitHandler = (event: RequestEvent) => handler(event.request)

  const handle: Handle = async ({ event, resolve }) => {
    (event.locals as any).getSession = async (): Promise<GauSession<ProviderIds<AuthInstance<TProviders>>>> => {
      const requestCookies = parseCookies(event.request.headers.get('Cookie'))
      let sessionToken = requestCookies.get(SESSION_COOKIE_NAME)

      if (!sessionToken) {
        const authHeader = event.request.headers.get('Authorization')
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
    return resolve(event)
  }

  return {
    GET: sveltekitHandler,
    POST: sveltekitHandler,
    OPTIONS: sveltekitHandler,
    handle,
  }
}
