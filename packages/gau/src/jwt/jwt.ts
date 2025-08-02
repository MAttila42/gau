/// <reference types="node" />
import {
  createJWTSignatureMessage,
  encodeJWT,
  JWSRegisteredHeaders,
  JWTRegisteredClaims,
  parseJWT,
} from '@oslojs/jwt'
import { AuthError } from '../core/index'
import { constantTimeEqual, deriveKeysFromSecret, rawToDer } from './utils'

export type SupportedAlgorithm = 'ES256' | 'HS256'

interface CommonSignOptions {
  /** Time-to-live in seconds (exp claim). If omitted the token will not expire. */
  ttl?: number
}

export type SignOptions
  = | ({ algorithm?: 'ES256', privateKey?: CryptoKey, secret?: string }
    & CommonSignOptions & { iss?: string, aud?: string | string[], sub?: string })
  | ({ algorithm: 'HS256', secret?: string | Uint8Array, privateKey?: never }
    & CommonSignOptions & { iss?: string, aud?: string | string[], sub?: string })

/**
 * Create a signed JWT.
 * Defaults to ES256 when a privateKey is supplied. Falls back to HS256 when a secret is supplied.
 */
export async function sign<T extends Record<string, unknown>>(payload: T, options: SignOptions = {}): Promise<string> {
  let { algorithm = 'ES256', ttl, iss, aud, sub, privateKey, secret } = options

  if (algorithm === 'ES256') {
    if (!privateKey) {
      if (typeof secret !== 'string')
        throw new AuthError('Missing secret for ES256 signing. It must be a base64url-encoded string.');

      ({ privateKey } = await deriveKeysFromSecret(secret))
    }
  }
  else if (algorithm === 'HS256' && !secret) {
    throw new AuthError('Missing secret for HS256 signing')
  }

  const now = Math.floor(Date.now() / 1000)

  const jwtPayload: Record<string, unknown> = { iat: now, iss, aud, sub, ...payload }

  if (ttl != null && ttl > 0)
    jwtPayload.exp = now + ttl

  const isHS256 = algorithm === 'HS256'
  const alg: SupportedAlgorithm = isHS256 ? 'HS256' : 'ES256'

  const headerJSON = JSON.stringify({ alg, typ: 'JWT' })
  const payloadJSON = JSON.stringify(jwtPayload)

  const signatureMessage = createJWTSignatureMessage(headerJSON, payloadJSON)

  let signature: Uint8Array

  if (isHS256) {
    // HS256 (HMAC-SHA256)
    const secretBytes = typeof secret === 'string'
      ? new TextEncoder().encode(secret)
      : secret

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      secretBytes as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    signature = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, signatureMessage as BufferSource))
  }
  else {
    // ES256 (ECDSA-SHA256)
    // Runtimes like Bun's return the raw (r||s) signature directly, not DER-encoded.
    signature = new Uint8Array(
      await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        privateKey!,
        signatureMessage as BufferSource,
      ),
    )
  }

  return encodeJWT(headerJSON, payloadJSON, signature)
}

export type VerifyOptions
  = | { algorithm?: 'ES256', publicKey?: CryptoKey, secret?: string, iss?: string, aud?: string | string[] }
    | { algorithm: 'HS256', secret?: string | Uint8Array, publicKey?: never, iss?: string, aud?: string | string[] }

/**
 * Verify a JWT and return its payload when the signature is valid.
 * The algorithm is inferred from options – ES256 by default.
 * Throws when verification fails or the token is expired.
 */
export async function verify<T = Record<string, unknown>>(token: string, options: VerifyOptions): Promise<T> {
  let { algorithm = 'ES256', publicKey, secret, iss, aud } = options

  if (algorithm === 'ES256') {
    if (!publicKey) {
      if (typeof secret !== 'string')
        throw new AuthError('Missing secret for ES256 verification. Must be a base64url-encoded string.');

      ({ publicKey } = await deriveKeysFromSecret(secret))
    }
  }

  if (algorithm === 'HS256' && !secret)
    throw new AuthError('Missing secret for HS256 verification')

  const [header, payload, signature, signatureMessage] = parseJWT(token)

  const headerParams = new JWSRegisteredHeaders(header)
  const headerAlg = headerParams.algorithm()

  let validSignature = false

  // HS256 verification path
  if (algorithm === 'HS256') {
    if (headerAlg !== 'HS256')
      throw new Error(`JWT algorithm is "${headerAlg}", but verifier was configured for "HS256"`)

    const secretBytes = typeof secret === 'string'
      ? new TextEncoder().encode(secret)
      : secret

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      secretBytes as BufferSource,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    const expectedSig = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, signatureMessage as BufferSource))
    validSignature = constantTimeEqual(expectedSig, new Uint8Array(signature))
  }
  // ES256 verification path (default)
  else {
    if (headerAlg !== 'ES256')
      throw new AuthError(`JWT algorithm is "${headerAlg}", but verifier was configured for "ES256"`)

    const signatureBytes = new Uint8Array(signature)

    // Runtimes like Node.js return DER-encoded signatures. Others (Bun) return raw (r||s).
    // We try DER first, as it's more common in Node environments.
    validSignature = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      publicKey!,
      signatureBytes as BufferSource,
      signatureMessage as BufferSource,
    )

    if (!validSignature && signatureBytes.length === 64) {
      // If DER verification fails and the signature is 64 bytes, it might be a raw signature.
      // Convert it to DER and try again.
      try {
        const derSig = rawToDer(signatureBytes)
        validSignature = await crypto.subtle.verify(
          { name: 'ECDSA', hash: 'SHA-256' },
          publicKey!,
          derSig as BufferSource,
          signatureMessage as BufferSource,
        )
      }
      catch {
        // rawToDer can throw if the signature is not 64 bytes, but we already checked.
        // This catch is for other unexpected errors.
        validSignature = false
      }
    }
  }

  if (!validSignature)
    throw new AuthError('Invalid JWT signature')

  const claims = new JWTRegisteredClaims(payload)
  if (claims.hasExpiration() && !claims.verifyExpiration())
    throw new AuthError('JWT expired')
  if (claims.hasNotBefore() && !claims.verifyNotBefore())
    throw new AuthError('JWT not yet valid')
  if (iss && (payload as any).iss !== iss)
    throw new AuthError('Invalid JWT issuer')

  if (aud) {
    const expectedAudience = Array.isArray(aud) ? aud : [aud]
    const tokenAudience = (payload as any).aud
      ? (Array.isArray((payload as any).aud) ? (payload as any).aud : [(payload as any).aud])
      : []

    if (!expectedAudience.some(audValue => tokenAudience.includes(audValue)))
      throw new AuthError('Invalid JWT audience')
  }

  return payload as T
}
