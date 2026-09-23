import { env } from '../config/env';
import type { AppointmentEvent } from '../events/appointment.events';
import logger from '../utils/logger';
import { RabbitMQConnection } from './rabbitmq';

const connection = new RabbitMQConnection({
  url: env.RABBITMQ_URL,
  connectionName: 'appointment-service:publisher',
  setup: async (channel) => {
    await channel.assertExchange(env.RABBITMQ_EXCHANGE, 'topic', { durable: true });
  },
});

export function startEventPublisher(): void {
  connection.start();
}

export function stopEventPublisher(): Promise<void> {
  return connection.close();
}

export function isEventPublisherConnected(): boolean {
  return connection.isConnected;
}

// Best-effort publish: resolves to false instead of throwing so a broker
// outage never fails the business operation that raised the event.
export async function publishEvent(event: AppointmentEvent): Promise<boolean> {
  const logMeta = {
    eventId: event.eventId,
    eventType: event.eventType,
    appointmentId: event.appointmentId,
  };

  const channel = connection.getChannel();
  if (!channel) {
    logger.error('Event not published: RabbitMQ is unavailable', logMeta);
    return false;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      channel.publish(
        env.RABBITMQ_EXCHANGE,
        event.eventType,
        Buffer.from(JSON.stringify(event)),
        {
          persistent: true,
          contentType: 'application/json',
          messageId: event.eventId,
          type: event.eventType,
          appId: 'appointment-service',
          timestamp: Math.floor(Date.parse(event.occurredAt) / 1000),
        },
        (err) => (err ? reject(err instanceof Error ? err : new Error(String(err))) : resolve()),
      );
    });
    logger.info('Event published', logMeta);
    return true;
  } catch (err) {
    logger.error('Event publish failed', {
      ...logMeta,
      error: err instanceof Error ? err.message : err,
    });
    return false;
  }
}
