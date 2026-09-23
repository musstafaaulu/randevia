import type { ConfirmChannel, ConsumeMessage } from 'amqplib';
import {
  createMessageHandler,
  getRetryCount,
  parseAppointmentEvent,
  PoisonMessageError,
  RETRY_COUNT_HEADER,
} from '../../src/messaging/messageHandler';
import { RETRY_QUEUE } from '../../src/messaging/topology';
import { makeEvent } from '../utils/events';

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

type SendCallback = (err: unknown) => void;

function fakeChannel() {
  return {
    ack: jest.fn(),
    nack: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
    sendToQueue: jest.fn((_q: string, _c: Buffer, _o: unknown, cb: SendCallback) => {
      cb(null);
      return true;
    }),
  };
}

function message(body: unknown, headers: Record<string, unknown> = {}): ConsumeMessage {
  const content = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  return {
    content,
    fields: {
      deliveryTag: 1,
      redelivered: false,
      exchange: 'randevia.events',
      routingKey: 'appointment.created',
      consumerTag: 'ctag',
    },
    properties: { headers, messageId: 'm-1', contentType: 'application/json' },
  } as unknown as ConsumeMessage;
}

function setup(process = jest.fn().mockResolvedValue(undefined)) {
  const channel = fakeChannel();
  const handle = createMessageHandler(channel as unknown as ConfirmChannel, {
    process,
    maxRetries: 3,
    retryDelayMs: 5000,
  });
  return { channel, handle, process };
}

describe('parseAppointmentEvent', () => {
  it('parses a valid event', () => {
    const event = makeEvent();
    expect(parseAppointmentEvent(Buffer.from(JSON.stringify(event)))).toEqual(event);
  });

  it.each([
    ['invalid JSON', '{not json'],
    ['an unknown event type', JSON.stringify(makeEvent({ eventType: 'appointment.x' as never }))],
    ['an invalid id', JSON.stringify(makeEvent({ patientId: 'nope' }))],
    ['missing fields', JSON.stringify({ eventId: 'x' })],
  ])('rejects %s as a poison message', (_label, body) => {
    expect(() => parseAppointmentEvent(Buffer.from(body))).toThrow(PoisonMessageError);
  });
});

describe('getRetryCount', () => {
  it('defaults to 0 and ignores garbage', () => {
    expect(getRetryCount(message({}))).toBe(0);
    expect(getRetryCount(message({}, { [RETRY_COUNT_HEADER]: 'abc' }))).toBe(0);
    expect(getRetryCount(message({}, { [RETRY_COUNT_HEADER]: 2 }))).toBe(2);
  });
});

describe('createMessageHandler', () => {
  it('acks after the event is processed', async () => {
    const { channel, handle, process } = setup();
    const event = makeEvent();
    const msg = message(event);

    await handle(msg);

    expect(process).toHaveBeenCalledWith(event);
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('dead-letters malformed JSON without processing, retrying or requeueing', async () => {
    const { channel, handle, process } = setup();
    const msg = message('{broken');

    await handle(msg);

    expect(process).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.sendToQueue).not.toHaveBeenCalled();
  });

  it('dead-letters schema-invalid events', async () => {
    const { channel, handle } = setup();
    const msg = message({ ...makeEvent(), doctorUserId: undefined });

    await handle(msg);

    expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
  });

  it('schedules a delayed retry with an incremented counter on transient failure', async () => {
    const { channel, handle } = setup(jest.fn().mockRejectedValue(new Error('db down')));
    const msg = message(makeEvent(), { [RETRY_COUNT_HEADER]: 1 });

    await handle(msg);

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      RETRY_QUEUE,
      msg.content,
      expect.objectContaining({
        persistent: true,
        expiration: '5000',
        headers: expect.objectContaining({ [RETRY_COUNT_HEADER]: 2 }),
      }),
      expect.any(Function),
    );
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('dead-letters once retries are exhausted', async () => {
    const { channel, handle } = setup(jest.fn().mockRejectedValue(new Error('db down')));
    const msg = message(makeEvent(), { [RETRY_COUNT_HEADER]: 3 });

    await handle(msg);

    expect(channel.sendToQueue).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(msg, false, false);
  });

  it('requeues instead of losing the message when the retry cannot be scheduled', async () => {
    const { channel, handle } = setup(jest.fn().mockRejectedValue(new Error('db down')));
    channel.sendToQueue.mockImplementation((_q, _c, _o, cb) => {
      cb(new Error('nack'));
      return true;
    });
    const msg = message(makeEvent());

    await handle(msg);

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack).toHaveBeenCalledWith(msg, false, true);
  });

  it('does not throw when the channel closed before the ack', async () => {
    const { channel, handle } = setup();
    channel.ack.mockImplementation(() => {
      throw new Error('Channel closed');
    });

    await expect(handle(message(makeEvent()))).resolves.toBeUndefined();
  });

  it('closes the channel to resubscribe when the broker cancels the consumer', async () => {
    const { channel, handle } = setup();

    await handle(null);

    expect(channel.close).toHaveBeenCalled();
  });
});
