import amqp, { ChannelModel, ConfirmChannel } from 'amqplib';
import logger from '../utils/logger';

export interface RabbitMQConnectionOptions {
  url: string;
  connectionName: string;
  // Runs on every (re)connect: declare topology and register consumers here.
  setup: (channel: ConfirmChannel) => Promise<void>;
  initialDelayMs?: number;
  maxDelayMs?: number;
}

// Keeps a single connection + confirm channel alive. Never throws to callers:
// failures are logged and the connection is retried with exponential backoff.
export class RabbitMQConnection {
  private model: ChannelModel | null = null;
  private channel: ConfirmChannel | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempt = 0;
  private connecting = false;
  private stopped = true;

  constructor(private readonly options: RabbitMQConnectionOptions) {}

  get isConnected(): boolean {
    return this.channel !== null;
  }

  getChannel(): ConfirmChannel | null {
    return this.channel;
  }

  start(): void {
    this.stopped = false;
    void this.connect();
  }

  async close(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    const model = this.model;
    this.model = null;
    this.channel = null;
    if (model) {
      await model.close().catch(() => undefined);
      logger.info('RabbitMQ connection closed', { connection: this.options.connectionName });
    }
  }

  private async connect(): Promise<void> {
    if (this.stopped || this.connecting) return;
    this.connecting = true;

    let model: ChannelModel | null = null;
    try {
      model = await amqp.connect(this.options.url, {
        clientProperties: { connection_name: this.options.connectionName },
      });
      const currentModel = model;
      currentModel.on('error', (err: Error) =>
        logger.error('RabbitMQ connection error', { error: err.message }),
      );
      currentModel.on('close', () => this.handleDisconnect(currentModel));

      const channel = await currentModel.createConfirmChannel();
      channel.on('error', (err: Error) =>
        logger.error('RabbitMQ channel error', { error: err.message }),
      );
      // A channel can be closed by the broker while the connection survives
      // (e.g. a protocol error). Drop the whole connection so it is rebuilt.
      channel.on('close', () => {
        if (this.channel === channel) void currentModel.close().catch(() => undefined);
      });

      await this.options.setup(channel);

      if (this.stopped) {
        await currentModel.close().catch(() => undefined);
        return;
      }

      this.model = currentModel;
      this.channel = channel;
      this.attempt = 0;
      logger.info('RabbitMQ connected', { connection: this.options.connectionName });
    } catch (err) {
      logger.error('RabbitMQ connection failed', {
        connection: this.options.connectionName,
        error: err instanceof Error ? err.message : err,
      });
      if (model) await model.close().catch(() => undefined);
      this.scheduleReconnect();
    } finally {
      this.connecting = false;
    }
  }

  private handleDisconnect(model: ChannelModel): void {
    if (this.model !== model) return;
    this.model = null;
    this.channel = null;
    if (this.stopped) return;

    logger.warn('RabbitMQ connection lost', { connection: this.options.connectionName });
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;

    const initialDelay = this.options.initialDelayMs ?? 1000;
    const maxDelay = this.options.maxDelayMs ?? 30000;
    const baseDelay = Math.min(maxDelay, initialDelay * 2 ** this.attempt);
    const delay = Math.round(baseDelay * (0.8 + Math.random() * 0.4));
    this.attempt += 1;

    logger.warn(`Reconnecting to RabbitMQ in ${delay}ms`, {
      connection: this.options.connectionName,
      attempt: this.attempt,
    });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, delay);
  }
}
