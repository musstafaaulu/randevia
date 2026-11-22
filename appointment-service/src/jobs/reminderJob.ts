import { env } from '../config/env';
import { sendDueReminders } from '../services/appointment.service';
import logger from '../utils/logger';

let timer: ReturnType<typeof setInterval> | undefined;
let running = false;

async function tick(): Promise<void> {
  if (running) return; // a previous tick is still working through its batch
  running = true;
  try {
    const sent = await sendDueReminders(env.REMINDER_LEAD_TIME_MS);
    if (sent > 0) logger.info('Appointment reminders queued', { count: sent });
  } catch (err) {
    logger.error('Reminder job tick failed', { error: err instanceof Error ? err.message : err });
  } finally {
    running = false;
  }
}

export function startReminderJob(): void {
  if (timer) return;
  timer = setInterval(() => void tick(), env.REMINDER_CHECK_INTERVAL_MS);
  void tick();
}

export function stopReminderJob(): void {
  if (timer) clearInterval(timer);
  timer = undefined;
}

// Exposed for tests: runs exactly one tick instead of waiting for the
// interval timer, so tests don't need real wall-clock delays.
export const runReminderTickForTests = tick;
