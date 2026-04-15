import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import type { FastifyRequest, FastifyReply } from 'fastify'
import { User } from '../models/user.js'

// Issuer as seen in JWT tokens (must match Rauthy's PUB_URL)
const RAUTHY_ISSUER = process.env.RAUTHY_ISSUER ?? 'http://localhost/rauthy'
// Internal URL for JWKS — container-to-container, bypasses nginx
const RAUTHY_JWKS_URL = process.env.RAUTHY_JWKS_URL ?? 'http://rauthy:8080/oidc/certs'

const JWKS = createRemoteJWKSet(new URL(RAUTHY_JWKS_URL))

export interface AuthPayload extends JWTPayload {
  email?: string
  name?: string
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify<AuthPayload>(token, JWKS, {
      issuer: RAUTHY_ISSUER,
    })
    return payload
  } catch {
    return null
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    reply.code(401).send({ error: 'Missing or malformed Authorization header' })
    return
  }

  const token = authHeader.slice(7)

  try {
    const { payload } = await jwtVerify<AuthPayload>(token, JWKS, {
      issuer: RAUTHY_ISSUER,
    })
    ;(request as FastifyRequest & { user: AuthPayload }).user = payload

    // Upsert the user's profile in the local directory so they can be found
    // by email when other users invite them to a board.
    if (payload.sub && payload.email) {
      User.findOneAndUpdate(
        { sub: payload.sub },
        { email: payload.email, name: payload.name ?? payload.email },
        { upsert: true },
      ).catch(() => { /* non-fatal */ })
    }
  } catch (err) {
    request.log.warn({ err }, 'JWT validation failed')
    reply.code(401).send({ error: 'Invalid or expired token' })
  }
}
