import mongoose from 'mongoose'

let connectionPromise

export function getMongoUrl() {
  return process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/codexexample'
}

export async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose
  }

  if (!connectionPromise) {
    connectionPromise = mongoose.connect(getMongoUrl(), {
      serverSelectionTimeoutMS: 5000,
    })
  }

  await connectionPromise
  return mongoose
}

export async function disconnectFromDatabase() {
  connectionPromise = null

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect()
  }
}
