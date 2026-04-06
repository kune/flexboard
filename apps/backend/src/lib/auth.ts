import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import type { FastifyRequest, FastifyReply } from 'fastify'

// Issuer as seen in JWT tokens (must match `issuer` in config/dex.yaml)
const DEX_ISSUER = process.env.DEX_ISSUER ?? 'http://localhost/dex'
// Internal URL for JWKS — container-to-container, bypasses nginx
const DEX_JWKS_URL = process.env.DEX_JWKS_URL ?? 'http://dex:5556/dex/keys'

const JWKS = createRemoteJWKSet(new URL(DEX_JWKS_URL))

export interface AuthPayload extends JWTPayload {
  email?: string
  name?: string
}

export async function verifyToken(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify<AuthPayload>(token, JWKS, {
      issuer: DEX_ISSUER,
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
      issuer: DEX_ISSUER,
    })
    ;(request as FastifyRequest & { user: AuthPayload }).user = payload
  } catch (err) {
    request.log.warn({ err }, 'JWT validation failed')
    reply.code(401).send({ error: 'Invalid or expired token' })
  }
}
