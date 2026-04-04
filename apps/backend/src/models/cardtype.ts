import mongoose, { type Document, type Model } from 'mongoose'
import type { CardTypeSchema } from '@flexboard/shared'

export interface ICardTypeSchema extends Document, CardTypeSchema {}

const attributeFieldSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    type: { type: String, required: true },
    required: { type: Boolean, required: true },
    values: { type: [String] },
  },
  { _id: false },
)

const cardTypeSchema = new mongoose.Schema<ICardTypeSchema>({
  type: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  attributes: { type: [attributeFieldSchema], default: [] },
})

cardTypeSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id
    delete ret._id
    delete ret.__v
  },
})

export const CardTypeModel: Model<ICardTypeSchema> = mongoose.model('CardType', cardTypeSchema)
