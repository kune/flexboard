import mongoose, { type Document, type Model } from 'mongoose'

// ── Column ────────────────────────────────────────────────────────────────────

export interface IColumn extends Document {
  boardId: mongoose.Types.ObjectId
  name: string
  position: number
  createdAt: Date
}

const columnSchema = new mongoose.Schema<IColumn>(
  {
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
    name: { type: String, required: true },
    position: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

columnSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id
    delete ret._id
    delete ret.__v
  },
})

export const Column: Model<IColumn> = mongoose.model('Column', columnSchema)

// ── Board ─────────────────────────────────────────────────────────────────────

export interface IBoard extends Document {
  name: string
  description?: string
  ownerId: string
  memberIds: string[]
  createdAt: Date
  updatedAt: Date
}

const boardSchema = new mongoose.Schema<IBoard>(
  {
    name: { type: String, required: true },
    description: { type: String },
    ownerId: { type: String, required: true, index: true },
    memberIds: { type: [String], default: [] },
  },
  { timestamps: true },
)

boardSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id
    delete ret._id
    delete ret.__v
  },
})

export const Board: Model<IBoard> = mongoose.model('Board', boardSchema)
