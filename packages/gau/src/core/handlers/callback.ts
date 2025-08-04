import type { Auth } from '../createAuth'
import type { RequestLike, ResponseLike, User } from '../index'
import {
  CALLBACK_URI_COOKIE_NAME,
  Cookies,
  CSRF_COOKIE_NAME,
  LINKING_TOKEN_COOKIE_NAME,
  parseCookies,
  PKCE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from '../cookies'
import { json, redirect } from '../index'

export async function handleCallback(request: RequestLike, auth: Auth, providerId: string): Promise<ResponseLike> {
  const provider = auth.providerMap.get(providerId)
  if (!provider)
    return json({ error: 'Provider not found' }, { status: 400 })

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state)
    return json({ error: 'Missing code or state' }, { status: 400 })

  const requestCookies = parseCookies(request.headers.get('Cookie'))
  const cookies = new Cookies(requestCookies, auth.cookieOptions)

  let savedState: string | undefined
  let redirectTo = '/'
  if (state.includes('.')) {
    const [originalSavedState, encodedRedirect] = state.split('.')
    savedState = originalSavedState
    try {
      redirectTo = atob(encodedRedirect ?? '') || '/'
    }
    catch {
      redirectTo = '/'
    }
  }
  else {
    savedState = state
  }

  const csrfToken = cookies.get(CSRF_COOKIE_NAME)

  if (!csrfToken || csrfToken !== savedState)
    return json({ error: 'Invalid CSRF token' }, { status: 403 })

  const codeVerifier = cookies.get(PKCE_COOKIE_NAME)
  if (!codeVerifier)
    return json({ error: 'Missing PKCE code verifier' }, { status: 400 })

  const callbackUri = cookies.get(CALLBACK_URI_COOKIE_NAME)
  const linkingToken = cookies.get(LINKING_TOKEN_COOKIE_NAME)

  if (linkingToken)
    cookies.delete(LINKING_TOKEN_COOKIE_NAME)

  const isLinking = !!linkingToken

  if (isLinking) {
    const session = await auth.validateSession(linkingToken!)
    if (!session) {
      cookies.delete(CSRF_COOKIE_NAME)
      cookies.delete(PKCE_COOKIE_NAME)
      if (callbackUri)
        cookies.delete(CALLBACK_URI_COOKIE_NAME)
      const response = redirect(redirectTo)
      cookies.toHeaders().forEach((value, key) => response.headers.append(key, value))
      return response
    }
  }

  const { user: providerUser, tokens } = await provider.validateCallback(code, codeVerifier, callbackUri ?? undefined)

  let user: User | null = null

  const userFromAccount = await auth.getUserByAccount(providerId, providerUser.id)

  if (isLinking) {
    const session = await auth.validateSession(linkingToken!)
    user = session!.user

    if (!user)
      return json({ error: 'User not found' }, { status: 404 })

    if (userFromAccount && userFromAccount.id !== user.id)
      return json({ error: 'Account already linked to another user' }, { status: 409 })
  }
  else {
    user = userFromAccount
  }

  if (!user) {
    const autoLink = auth.autoLink ?? 'verifiedEmail'
    const shouldLinkByEmail = providerUser.email && (
      (autoLink === 'always')
      || (autoLink === 'verifiedEmail' && providerUser.emailVerified === true)
    )
    if (shouldLinkByEmail) {
      const existingUser = await auth.getUserByEmail(providerUser.email!)
      if (existingUser) {
        // If the email is verified by the new provider, and the existing user's email is not,
        // update the user's email verification status.
        if (providerUser.emailVerified && !existingUser.emailVerified) {
          user = await auth.updateUser({
            id: existingUser.id,
            emailVerified: true,
          })
        }
        else {
          user = existingUser
        }
      }
    }
    if (!user) {
      try {
        user = await auth.createUser({
          name: providerUser.name,
          email: providerUser.email,
          image: providerUser.avatar,
          emailVerified: providerUser.emailVerified,
        })
      }
      catch (error) {
        console.error('Failed to create user:', error)
        return json({ error: 'Failed to create user' }, { status: 500 })
      }
    }
  }

  // self-healing: update user's email if it's missing or unverified and the provider returns a verified email
  if (user && providerUser.email) {
    const { email: currentEmail, emailVerified: currentEmailVerified } = user
    const { email: providerEmail, emailVerified: providerEmailVerified } = providerUser

    const update: Partial<User> & { id: string } = { id: user.id }
    let needsUpdate = false

    // user has no primary email. promote the provider's email.
    if (!currentEmail) {
      update.email = providerEmail
      update.emailVerified = providerEmailVerified ?? false
      needsUpdate = true
    }
    // user has an unverified primary email, and the provider confirms this same email is verified.
    else if (
      currentEmail === providerEmail
      && providerEmailVerified === true
      && !currentEmailVerified
    ) {
      update.emailVerified = true
      needsUpdate = true
    }

    if (needsUpdate) {
      try {
        user = await auth.updateUser(update)
      }
      catch (error) {
        console.error('Failed to update user after sign-in:', error)
      }
    }
  }

  if (!userFromAccount) {
    // GitHub sometimes doesn't return these which causes arctic to throw an error
    let refreshToken: string | null
    try {
      refreshToken = tokens.refreshToken()
    }
    catch {
      refreshToken = null
    }

    let expiresAt: number | undefined
    try {
      const expiresAtDate = tokens.accessTokenExpiresAt()
      if (expiresAtDate)
        expiresAt = Math.floor(expiresAtDate.getTime() / 1000)
    }
    catch {
    }

    let idToken: string | null
    try {
      idToken = tokens.idToken()
    }
    catch {
      idToken = null
    }

    try {
      await auth.linkAccount({
        userId: user.id,
        provider: providerId,
        providerAccountId: providerUser.id,
        accessToken: tokens.accessToken(),
        refreshToken,
        expiresAt,
        tokenType: tokens.tokenType?.() ?? null,
        scope: tokens.scopes()?.join(' ') ?? null,
        idToken,
      })
    }
    catch (error) {
      console.error('Error linking account:', error)
      return json({ error: 'Failed to link account' }, { status: 500 })
    }
  }

  const sessionToken = await auth.createSession(user.id)

  const requestUrl = new URL(request.url)
  const redirectUrl = new URL(redirectTo, request.url)

  const forceToken = auth.sessionStrategy === 'token'
  const forceCookie = auth.sessionStrategy === 'cookie'

  const isDesktopRedirect = redirectUrl.protocol === 'gau:'
  const isMobileRedirect = requestUrl.host !== redirectUrl.host

  // For Tauri, we can't set a cookie on a custom protocol or a different host,
  // so we pass the token in the URL. Additionally, return a small HTML page
  // that immediately navigates to the deep-link and attempts to close the window,
  // so the external OAuth tab does not stay open.
  if (forceToken || (!forceCookie && (isDesktopRedirect || isMobileRedirect))) {
    const destination = new URL(redirectUrl)
    // Use hash instead of query param for security. The hash is not sent to the server.
    destination.hash = `token=${sessionToken}`

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Authentication Complete</title>
  <style>
    body {
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
      background-color: #09090b;
      color: #fafafa;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      text-align: center;
    }
    .card {
      background-color: #18181b;
      border: 1px solid #27272a;
      border-radius: 0.75rem;
      padding: 2rem;
      max-width: 320px;
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0 0 0.5rem;
    }
    p {
      margin: 0;
      color: #a1a1aa;
    }
  </style>
  <script>
    window.onload = function() {
      const url = ${JSON.stringify(destination.toString())};
      window.location.href = url;
      setTimeout(window.close, 500);
    };
  </script>
</head>
<body>
  <div class="card">
    <h1>Authentication Successful</h1>
    <p>You can now close this window.</p>
  </div>
</body>
</html>`

    // Clear temporary cookies (CSRF/PKCE/Callback URI) so they don't linger
    cookies.delete(CSRF_COOKIE_NAME)
    cookies.delete(PKCE_COOKIE_NAME)
    if (callbackUri)
      cookies.delete(CALLBACK_URI_COOKIE_NAME)

    const response = new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
    cookies.toHeaders().forEach((value, key) => {
      response.headers.append(key, value)
    })
    return response
  }

  cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    maxAge: auth.jwt.ttl,
    sameSite: auth.development ? 'lax' : 'none',
    secure: !auth.development,
  })
  cookies.delete(CSRF_COOKIE_NAME)
  cookies.delete(PKCE_COOKIE_NAME)
  if (callbackUri)
    cookies.delete(CALLBACK_URI_COOKIE_NAME)

  const redirectParam = url.searchParams.get('redirect')

  let response: Response
  if (redirectParam === 'false') {
    const accounts = await auth.getAccounts(user.id)
    response = json({ user: { ...user, accounts } })
  }
  else {
    response = redirect(redirectTo)
  }

  cookies.toHeaders().forEach((value, key) => {
    response.headers.append(key, value)
  })

  return response
}
