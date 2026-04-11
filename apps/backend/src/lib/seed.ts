import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import type { CardTypeSchema } from '@flexboard/shared'
import { CardTypeModel } from '../models/cardtype.js'

function findCardTypesConfig(): string {
  // Docker: cwd is /app, file is at /app/config/card-types.yaml
  // Dev: cwd is apps/backend (pnpm --filter sets package dir), file is at repo root
  const candidates = [
    resolve(process.cwd(), 'config/card-types.yaml'),
    resolve(process.cwd(), '../../config/card-types.yaml'),
  ]
  const found = candidates.find(existsSync)
  if (!found) throw new Error(`card-types.yaml not found (searched: ${candidates.join(', ')})`)
  return found
}

export async function seedCardTypes(): Promise<void> {
  const configPath = findCardTypesConfig()
  const raw = readFileSync(configPath, 'utf8')
  const schemas = yaml.load(raw) as CardTypeSchema[]

  for (const schema of schemas) {
    await CardTypeModel.findOneAndUpdate(
      { type: schema.type },
      schema,
      { upsert: true, new: true },
    )
  }
}
