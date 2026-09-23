import mongoose from 'mongoose';
import logger from '../utils/logger';
import { env } from './env';

mongoose.connection.on('connected', () => logger.info('MongoDB connected'));
mongoose.connection.on('error', (err: Error) => logger.error('MongoDB connection error', { error: err.message }));
mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

export async function connectDB(): Promise<void> {
  await mongoose.connect(env.MONGO_URI);
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
