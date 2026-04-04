import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import type { CardTypeSchema } from '@flexboard/shared'
import { CardTypeModel } from '../models/cardtype.js'

export async function seedCardTypes(): Promise<void> {
  const configPath = resolve(process.cwd(), 'config/card-types.yaml')
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
