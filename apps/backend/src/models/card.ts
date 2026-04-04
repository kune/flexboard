import mongoose, { type Document, type Model } from 'mongoose'

export interface ICard extends Document {
  boardId: mongoose.Types.ObjectId
  columnId: mongoose.Types.ObjectId
  type: string
  title: string
  description?: string
  position: number
  createdBy: string
  attributes: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

const cardSchema = new mongoose.Schema<ICard>(
  {
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
    columnId: { type: mongoose.Schema.Types.ObjectId, ref: 'Column', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    position: { type: Number, required: true },
    createdBy: { type: String, required: true },
    attributes: { type: Map, of: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
)

cardSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id
    // Serialise Map → plain object
    if (ret.attributes instanceof Map) {
      ret.attributes = Object.fromEntries(ret.attributes)
    }
    delete ret._id
    delete ret.__v
  },
})

export const Card: Model<ICard> = mongoose.model('Card', cardSchema)
