import { publishEvent } from './eventPublisher';
import { OutboxEvent } from '../models/OutboxEvent.model';
import logger from '../utils/logger';

const POLL_INTERVAL_MS = 2000;
const BATCH_SIZE = 20;

let timer: ReturnType<typeof setInterval> | undefined;
let running = false;

// Polls for outbox rows nobody has published yet and retries them through
// the normal (best-effort) publisher. Runs independently of any request: a
// row written while RabbitMQ was down just sits there, unpublished, until a
// later tick finds the broker back up - nothing is lost and nothing needs to
// remember to retry it.
async function publishPending(): Promise<void> {
  if (running) return; // a previous tick is still draining a batch
  running = true;
  try {
    const pending = await OutboxEvent.find({ publishedAt: null }).sort({ createdAt: 1 }).limit(BATCH_SIZE);

    for (const event of pending) {
      const ok = await publishEvent(event.payload);
      if (ok) {
        event.publishedAt = new Date();
        await event.save();
      } else {
        event.attempts += 1;
        event.lastError = 'RabbitMQ unavailable or publish failed';
        await event.save();
        // Stop this batch - if the broker is down for one event it's down
        // for all of them, so there's no point burning through the rest.
        break;
      }
    }
  } catch (err) {
    logger.error('Outbox publisher tick failed', {
      error: err instanceof Error ? err.message : err,
    });
  } finally {
    running = false;
  }
}

export function startOutboxPublisher(): void {
  if (timer) return;
  timer = setInterval(() => void publishPending(), POLL_INTERVAL_MS);
  void publishPending();
}

export function stopOutboxPublisher(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}

// Exposed for tests: runs exactly one poll/publish pass instead of waiting
// for the interval timer, so tests don't need real wall-clock delays.
export const runOutboxTickForTests = publishPending;
