const mockGetChannel = jest.fn();

jest.mock('../../src/messaging/rabbitmq', () => ({
  RabbitMQConnection: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    close: jest.fn(),
    getChannel: mockGetChannel,
  })),
}));

import { rabbitmqQueueMessages } from '../../src/middlewares/metrics';
import { pollQueueLengthsForTests } from '../../src/messaging/queueLengthPoller';
import { DEAD_LETTER_QUEUE, QUEUE, RETRY_QUEUE } from '../../src/messaging/topology';

async function metricValue(queue: string): Promise<number | undefined> {
  const values = await rabbitmqQueueMessages.get();
  return values.values.find((v) => v.labels.queue === queue)?.value;
}

afterEach(() => {
  mockGetChannel.mockReset();
});

describe('queue length poller', () => {
  it('sets a gauge per queue from checkQueue', async () => {
    const checkQueue = jest.fn().mockImplementation((queue: string) =>
      Promise.resolve({ queue, messageCount: queue === QUEUE ? 3 : 0, consumerCount: 1 }),
    );
    mockGetChannel.mockReturnValue({ checkQueue });

    await pollQueueLengthsForTests();

    expect(checkQueue).toHaveBeenCalledWith(QUEUE);
    expect(checkQueue).toHaveBeenCalledWith(RETRY_QUEUE);
    expect(checkQueue).toHaveBeenCalledWith(DEAD_LETTER_QUEUE);
    expect(await metricValue(QUEUE)).toBe(3);
    expect(await metricValue(RETRY_QUEUE)).toBe(0);
  });

  it('does nothing when there is no channel yet (not connected)', async () => {
    mockGetChannel.mockReturnValue(null);

    await expect(pollQueueLengthsForTests()).resolves.toBeUndefined();
  });

  it('keeps polling the other queues when one checkQueue call fails', async () => {
    const checkQueue = jest
      .fn()
      .mockRejectedValueOnce(new Error('channel closed'))
      .mockImplementation((queue: string) => Promise.resolve({ queue, messageCount: 7, consumerCount: 1 }));
    mockGetChannel.mockReturnValue({ checkQueue });

    await pollQueueLengthsForTests();

    expect(checkQueue).toHaveBeenCalledTimes(3);
  });
});
