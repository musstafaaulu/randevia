import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import { ZodError } from 'zod';
import { env } from '../config/env';
import { AppointmentEvent, appointmentEventSchema } from '../events/appointment.events';
import { processAppointmentEvent } from '../services/notification.service';
import logger from '../utils/logger';
import { RETRY_QUEUE } from './topology';

export const RETRY_COUNT_HEADER = 'x-retry-count';

// A message that can never be processed, no matter how often it is retried.
export class PoisonMessageError extends Error {
  constructor(
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'PoisonMessageError';
  }
}

export function parseAppointmentEvent(content: Buffer): AppointmentEvent {
  let raw: unknown;
  try {
    raw = JSON.parse(content.toString('utf8'));
  } catch {
    throw new PoisonMessageError('Message body is not valid JSON');
  }

  try {
    return appointmentEventSchema.parse(raw);
  } catch (err) {
    if (err instanceof ZodError) {
      throw new PoisonMessageError('Message does not match the event schema', err.flatten());
    }
    throw err;
  }
}

export function getRetryCount(msg: ConsumeMessage): number {
  const value = Number(msg.properties.headers?.[RETRY_COUNT_HEADER] ?? 0);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

export interface MessageHandlerDeps {
  process: (event: AppointmentEvent) => Promise<unknown>;
  maxRetries: number;
  retryDelayMs: number;
}

const defaultDeps: MessageHandlerDeps = {
  process: (event) => processAppointmentEvent(event),
  maxRetries: env.MESSAGE_MAX_RETRIES,
  retryDelayMs: env.MESSAGE_RETRY_DELAY_MS,
};

// Ack/nack decisions:
// - processed                    -> ack
// - poison (bad JSON / schema)   -> nack(requeue=false) -> dead-letter queue, no retries
// - transient failure, retries left -> copy to the delay queue with x-retry-count+1, then ack
// - transient failure, no retries   -> nack(requeue=false) -> dead-letter queue
// Nothing is ever nacked with requeue=true on processing errors, which is what
// would make a failing message spin in a hot loop.
export function createMessageHandler(
  channel: ConfirmChannel,
  deps: MessageHandlerDeps = defaultDeps,
): (msg: ConsumeMessage | null) => Promise<void> {
  // Acks must go to the channel that delivered the message; if it has closed
  // in the meantime the broker redelivers the message on the next channel.
  function settle(action: () => void, msg: ConsumeMessage): void {
    try {
      action();
    } catch (err) {
      logger.warn('Could not settle message, it will be redelivered', {
        deliveryTag: msg.fields.deliveryTag,
        error: err instanceof Error ? err.message : err,
      });
    }
  }

  function scheduleRetry(msg: ConsumeMessage, retryCount: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        channel.sendToQueue(
          RETRY_QUEUE,
          msg.content,
          {
            ...msg.properties,
            persistent: true,
            expiration: String(deps.retryDelayMs),
            headers: { ...msg.properties.headers, [RETRY_COUNT_HEADER]: retryCount },
          },
          (err) => (err ? reject(err instanceof Error ? err : new Error(String(err))) : resolve()),
        );
      } catch (err) {
        reject(err);
      }
    });
  }

  return async (msg) => {
    if (!msg) {
      // The broker cancelled the consumer (e.g. queue deleted). Closing the
      // channel makes the connection manager rebuild topology and resubscribe.
      logger.warn('Consumer cancelled by RabbitMQ, resubscribing');
      await channel.close().catch(() => undefined);
      return;
    }

    const meta = {
      messageId: msg.properties.messageId as string | undefined,
      routingKey: msg.fields.routingKey,
      redelivered: msg.fields.redelivered,
    };

    let event: AppointmentEvent;
    try {
      event = parseAppointmentEvent(msg.content);
    } catch (err) {
      logger.error('Rejecting malformed message to dead-letter queue', {
        ...meta,
        error: err instanceof Error ? err.message : err,
        details: err instanceof PoisonMessageError ? err.details : undefined,
      });
      settle(() => channel.nack(msg, false, false), msg);
      return;
    }

    const eventMeta = { ...meta, eventId: event.eventId, eventType: event.eventType };
    try {
      await deps.process(event);
      settle(() => channel.ack(msg), msg);
      logger.info('Event processed', eventMeta);
    } catch (err) {
      const retryCount = getRetryCount(msg);
      const error = err instanceof Error ? err.message : err;

      if (retryCount >= deps.maxRetries) {
        logger.error('Event processing failed, retries exhausted; dead-lettering', {
          ...eventMeta,
          retryCount,
          error,
        });
        settle(() => channel.nack(msg, false, false), msg);
        return;
      }

      try {
        await scheduleRetry(msg, retryCount + 1);
        settle(() => channel.ack(msg), msg);
        logger.warn('Event processing failed, retry scheduled', {
          ...eventMeta,
          retry: retryCount + 1,
          maxRetries: deps.maxRetries,
          delayMs: deps.retryDelayMs,
          error,
        });
      } catch (retryErr) {
        // Could not park the message for a delayed retry (channel trouble);
        // leave it with the broker instead of losing it.
        logger.error('Could not schedule retry, requeueing message', {
          ...eventMeta,
          error: retryErr instanceof Error ? retryErr.message : retryErr,
        });
        settle(() => channel.nack(msg, false, true), msg);
      }
    }
  };
}
