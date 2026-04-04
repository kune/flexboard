import mongoose, { type Document, type Model } from 'mongoose'

export interface IActivityEntry extends Document {
  cardId:  mongoose.Types.ObjectId
  boardId: mongoose.Types.ObjectId
  actorId: string
  event:   string
  payload: Record<string, unknown>
  createdAt: Date
}

const activitySchema = new mongoose.Schema<IActivityEntry>(
  {
    cardId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Card',  required: true, index: true },
    boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    actorId: { type: String, required: true },
    event:   { type: String, required: true },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

activitySchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id
    delete ret._id
    delete ret.__v
  },
})

export const ActivityLog: Model<IActivityEntry> = mongoose.model('ActivityLog', activitySchema)
