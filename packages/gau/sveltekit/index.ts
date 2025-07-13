import type { RequestEvent } from '@sveltejs/kit'
import type { CreateAuthOptions } from '../core'
import { createAuth, createHandler } from '../core'

type AuthInstance = ReturnType<typeof createAuth>

/**
 * Creates GET and POST handlers for SvelteKit.
 *
 * @example
 * ```ts
 * // src/routes/api/auth/[...auth]/+server.ts
 * import { SvelteKitAuth } from '@yuo-app/gau/sveltekit'
 * // import { authOptions } from '~/server/auth'
 *
 * // export const { GET, POST } = SvelteKitAuth(authOptions)
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
  return {
    GET: sveltekitHandler,
    POST: sveltekitHandler,
  }
}
