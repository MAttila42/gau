import type { OAuth2Tokens } from 'arctic'
import type { Cookies } from './cookies'
import type { Auth } from './createAuth'

export interface OAuthExchangeContext {
  request: Request
  providerId: string
  state: string
  code: string
  codeVerifier: string
  callbackUri?: string | null
  redirectTo: string
  cookies: Cookies
  providerUser: any
  tokens: OAuth2Tokens
  isLinking: boolean
  sessionUserId?: string
}

export type OAuthExchangeResult = { handled: true, response: Response } | { handled: false }

export async function runOnOAuthExchange(auth: Auth | undefined, ctx: OAuthExchangeContext): Promise<OAuthExchangeResult> {
  if (!auth || typeof auth.onOAuthExchange !== 'function')
    return { handled: false }
  try {
    const res = await auth.onOAuthExchange(ctx)
    if (!res || typeof res !== 'object')
      return { handled: false }
    return res
  }
  catch (e) {
    console.error('onOAuthExchange hook error:', e)
    return { handled: false }
  }
}

export interface MapExternalProfileContext {
  request: Request
  providerId: string
  providerUser: any
  tokens: OAuth2Tokens
  isLinking: boolean
}

export async function maybeMapExternalProfile(auth: Auth | undefined, ctx: MapExternalProfileContext): Promise<any> {
  if (!auth || typeof auth.mapExternalProfile !== 'function')
    return ctx.providerUser
  try {
    const mapped = await auth.mapExternalProfile(ctx)
    if (!mapped)
      return ctx.providerUser
    return { ...ctx.providerUser, ...mapped }
  }
  catch (e) {
    console.error('mapExternalProfile hook error:', e)
    return ctx.providerUser
  }
}

export interface BeforeLinkAccountContext {
  request: Request
  providerId: string
  userId: string
  providerUser: any
  tokens: OAuth2Tokens
}

export async function runOnBeforeLinkAccount(auth: Auth | undefined, ctx: BeforeLinkAccountContext): Promise<{ allow: true } | { allow: false, response?: Response }> {
  if (!auth || typeof auth.onBeforeLinkAccount !== 'function')
    return { allow: true }
  try {
    const res = await auth.onBeforeLinkAccount(ctx)
    if (!res)
      return { allow: true }
    return res
  }
  catch (e) {
    console.error('onBeforeLinkAccount hook error:', e)
    return { allow: true }
  }
}

export interface AfterLinkAccountContext extends BeforeLinkAccountContext { action: 'link' | 'update' }

export async function runOnAfterLinkAccount(auth: Auth | undefined, ctx: AfterLinkAccountContext): Promise<void> {
  if (!auth || typeof auth.onAfterLinkAccount !== 'function')
    return
  try {
    await auth.onAfterLinkAccount(ctx)
  }
  catch (e) {
    console.error('onAfterLinkAccount hook error:', e)
  }
}
