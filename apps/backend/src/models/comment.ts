import mongoose, { type Document, type Model } from 'mongoose'

export interface IComment extends Document {
  cardId: mongoose.Types.ObjectId
  boardId: mongoose.Types.ObjectId
  authorId: string
  body: string
  createdAt: Date
  updatedAt: Date
}

const commentSchema = new mongoose.Schema<IComment>(
  {
    cardId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Card',  required: true, index: true },
    boardId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
    authorId: { type: String, required: true },
    body:     { type: String, required: true },
  },
  { timestamps: true },
)

commentSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id
    delete ret._id
    delete ret.__v
  },
})

export const Comment: Model<IComment> = mongoose.model('Comment', commentSchema)
