import mongoose from 'mongoose'

export async function connectDb(): Promise<void> {
  const uri = process.env.MONGO_URI ?? 'mongodb://localhost:27017/flexboard'
  await mongoose.connect(uri)
}
