import { Document, model, Schema, Types } from 'mongoose';
import type { AppointmentEvent, AppointmentEventType } from '../events/appointment.events';

// Transactional outbox: written in the same MongoDB transaction as the
// appointment change it describes, so the event can never be "lost" between
// the domain write succeeding and the message reaching RabbitMQ - a separate
// publisher (outboxPublisher.ts) picks up unpublished rows and retries them
// for as long as it takes, independent of whether the request that created
// them is still running or RabbitMQ was reachable at the time.
export interface IOutboxEvent extends Document {
  _id: Types.ObjectId;
  eventType: AppointmentEventType;
  payload: AppointmentEvent;
  publishedAt?: Date;
  attempts: number;
  lastError?: string;
  createdAt: Date;
  updatedAt: Date;
}

const outboxEventSchema = new Schema<IOutboxEvent>(
  {
    eventType: {
      type: String,
      required: [true, 'Olay türü gerekli'],
    },
    payload: {
      type: Schema.Types.Mixed,
      required: [true, 'Olay gövdesi gerekli'],
    },
    publishedAt: {
      type: Date,
      default: null,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    lastError: {
      type: String,
    },
  },
  { timestamps: true },
);

// The publisher's main query: unpublished rows, oldest first.
outboxEventSchema.index({ publishedAt: 1, createdAt: 1 });

export const OutboxEvent = model<IOutboxEvent>('OutboxEvent', outboxEventSchema);
