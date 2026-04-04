import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose'
import type { FastifyRequest, FastifyReply } from 'fastify'

// Internal URL for JWKS fetching (container-to-container, bypasses nginx)
const ZITADEL_DOMAIN = process.env.ZITADEL_DOMAIN ?? 'http://localhost:8080'
// Issuer as seen in JWT tokens (matches ZITADEL_EXTERNALDOMAIN:EXTERNALPORT)
const ZITADEL_ISSUER = process.env.ZITADEL_ISSUER ?? ZITADEL_DOMAIN
const PROJECT_ID = process.env.ZITADEL_PROJECT_ID

const JWKS = createRemoteJWKSet(
  new URL(`${ZITADEL_DOMAIN}/oauth/v2/keys`),
)

export interface AuthPayload extends JWTPayload {
  email?: string
  name?: string
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
      issuer: ZITADEL_ISSUER,
      ...(PROJECT_ID ? { audience: PROJECT_ID } : {}),
    })
    ;(request as FastifyRequest & { user: AuthPayload }).user = payload
  } catch (err) {
    request.log.warn({ err }, 'JWT validation failed')
    reply.code(401).send({ error: 'Invalid or expired token' })
  }
}
