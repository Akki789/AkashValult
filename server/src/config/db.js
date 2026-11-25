import mongoose from 'mongoose';
import { env } from './env.js';

mongoose.set('strictQuery', true);

let cachedConnectionPromise = null;

export async function connectDB(uri = env.MONGODB_URI) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!cachedConnectionPromise) {
    cachedConnectionPromise = mongoose
      .connect(uri, {
        serverSelectionTimeoutMS: 10000,
      })
      .then((conn) => conn)
      .catch((error) => {
        cachedConnectionPromise = null;
        console.error('MongoDB connection error:', error.message);
        throw error;
      });
  }

  return cachedConnectionPromise;
}

export async function disconnectDB() {
  cachedConnectionPromise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}
