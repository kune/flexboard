import type { FastifyInstance } from 'fastify'
import { requireAuth } from '../lib/auth.js'
import { CardTypeModel } from '../models/cardtype.js'

export async function cardTypeRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/card-types', { preHandler: requireAuth }, async () => {
    return CardTypeModel.find().sort({ type: 1 })
  })
}
