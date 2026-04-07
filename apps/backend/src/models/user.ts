import mongoose, { type Document, type Model } from 'mongoose'

export interface IUser extends Document {
  sub: string     // Dex subject claim — stable user identifier
  email: string
  name: string
}

const userSchema = new mongoose.Schema<IUser>(
  {
    sub: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
  },
  { timestamps: true },
)

userSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id
    delete ret._id
    delete ret.__v
  },
})

export const User: Model<IUser> = mongoose.model('User', userSchema)
