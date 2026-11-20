import { EventEmitter } from 'node:events';
import type { AppointmentEvent } from '../../src/events/appointment.events';

jest.mock('amqplib', () => ({ __esModule: true, default: { connect: jest.fn() } }));
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    http: jest.fn(),
    debug: jest.fn(),
  },
}));

type PublishCallback = (err: unknown) => void;

class FakeChannel extends EventEmitter {
  assertExchange = jest.fn().mockResolvedValue({});
  publish = jest.fn(
    (_ex: string, _key: string, _content: Buffer, _opts: unknown, cb: PublishCallback) => {
      cb(null);
      return true;
    },
  );
}

class FakeModel extends EventEmitter {
  constructor(public readonly channel = new FakeChannel()) {
    super();
  }
  createConfirmChannel = jest.fn(async () => this.channel);
  close = jest.fn(async () => {
    this.emit('close');
  });
}

const event: AppointmentEvent = {
  eventId: '6f1c1b1e-0000-4000-8000-000000000001',
  eventType: 'appointment.created',
  occurredAt: new Date().toISOString(),
  appointmentId: '64b000000000000000000001',
  patientId: '64b000000000000000000002',
  doctorId: '64b000000000000000000003',
  doctorUserId: '64b000000000000000000004',
  date: new Date(Date.now() + 86_400_000).toISOString(),
  status: 'pending',
};

// Fresh module graph per test: the publisher holds a module-level connection.
function load() {
  jest.resetModules();
  const amqp = jest.requireMock('amqplib').default as { connect: jest.Mock };
  const publisher = jest.requireActual<typeof import('../../src/messaging/eventPublisher')>(
    '../../src/messaging/eventPublisher',
  );
  const logger = jest.requireMock('../../src/utils/logger').default as { error: jest.Mock };
  return { amqp, publisher, logger };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('eventPublisher', () => {
  it('publishes a persistent JSON message to the topic exchange keyed by event type', async () => {
    const { amqp, publisher } = load();
    const model = new FakeModel();
    amqp.connect.mockResolvedValue(model);

    publisher.startEventPublisher();
    await jest.advanceTimersByTimeAsync(0);

    expect(model.channel.assertExchange).toHaveBeenCalledWith('randevia.events', 'topic', {
      durable: true,
    });
    await expect(publisher.publishEvent(event)).resolves.toBe(true);

    const [exchange, routingKey, content, options] = model.channel.publish.mock.calls[0]!;
    expect(exchange).toBe('randevia.events');
    expect(routingKey).toBe('appointment.created');
    expect(JSON.parse(content.toString())).toEqual(event);
    expect(options).toMatchObject({
      persistent: true,
      contentType: 'application/json',
      messageId: event.eventId,
      type: event.eventType,
    });

    await publisher.stopEventPublisher();
  });

  it('returns false and logs instead of throwing when RabbitMQ is unavailable', async () => {
    const { amqp, publisher, logger } = load();
    amqp.connect.mockRejectedValue(new Error('connect ECONNREFUSED'));

    publisher.startEventPublisher();
    await jest.advanceTimersByTimeAsync(0);

    await expect(publisher.publishEvent(event)).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'Event not published: RabbitMQ is unavailable',
      expect.objectContaining({ eventId: event.eventId }),
    );

    await publisher.stopEventPublisher();
  });

  it('returns false when the broker does not confirm the message', async () => {
    const { amqp, publisher, logger } = load();
    const model = new FakeModel();
    model.channel.publish.mockImplementation((_e, _k, _c, _o, cb) => {
      cb(new Error('message nacked'));
      return true;
    });
    amqp.connect.mockResolvedValue(model);

    publisher.startEventPublisher();
    await jest.advanceTimersByTimeAsync(0);

    await expect(publisher.publishEvent(event)).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'Event publish failed',
      expect.objectContaining({ error: 'message nacked' }),
    );

    await publisher.stopEventPublisher();
  });

  it('keeps retrying until RabbitMQ becomes reachable', async () => {
    const { amqp, publisher } = load();
    const model = new FakeModel();
    amqp.connect
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValue(model);

    publisher.startEventPublisher();
    await jest.advanceTimersByTimeAsync(0);
    expect(publisher.isEventPublisherConnected()).toBe(false);

    await jest.advanceTimersByTimeAsync(5_000);

    expect(amqp.connect).toHaveBeenCalledTimes(3);
    expect(publisher.isEventPublisherConnected()).toBe(true);

    await publisher.stopEventPublisher();
  });

  it('reconnects after the connection is lost', async () => {
    const { amqp, publisher } = load();
    const first = new FakeModel();
    const second = new FakeModel();
    amqp.connect.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    publisher.startEventPublisher();
    await jest.advanceTimersByTimeAsync(0);
    expect(publisher.isEventPublisherConnected()).toBe(true);

    first.emit('close', new Error('CONNECTION_FORCED'));
    expect(publisher.isEventPublisherConnected()).toBe(false);

    await jest.advanceTimersByTimeAsync(2_000);
    expect(publisher.isEventPublisherConnected()).toBe(true);
    await publisher.publishEvent(event);
    expect(second.channel.publish).toHaveBeenCalled();

    await publisher.stopEventPublisher();
  });

  it('rebuilds the connection when only the channel is closed by the broker', async () => {
    const { amqp, publisher } = load();
    const first = new FakeModel();
    const second = new FakeModel();
    amqp.connect.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

    publisher.startEventPublisher();
    await jest.advanceTimersByTimeAsync(0);

    first.channel.emit('close');
    await jest.advanceTimersByTimeAsync(2_000);

    expect(first.close).toHaveBeenCalled();
    expect(publisher.isEventPublisherConnected()).toBe(true);
    expect(amqp.connect).toHaveBeenCalledTimes(2);

    await publisher.stopEventPublisher();
  });

  it('stops retrying after shutdown', async () => {
    const { amqp, publisher } = load();
    amqp.connect.mockRejectedValue(new Error('connect ECONNREFUSED'));

    publisher.startEventPublisher();
    await jest.advanceTimersByTimeAsync(0);
    await publisher.stopEventPublisher();
    await jest.advanceTimersByTimeAsync(60_000);

    expect(amqp.connect).toHaveBeenCalledTimes(1);
  });
});
