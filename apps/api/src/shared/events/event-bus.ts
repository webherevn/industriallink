import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { DomainEventEnvelope, DomainEventName } from '@industriallink/contracts';
import amqp, { Channel, ChannelModel } from 'amqplib';
import type { AppConfig } from '../../config/configuration';

export type DomainEventHandler = (event: DomainEventEnvelope) => void | Promise<void>;

const EXCHANGE = 'industriallink.domain';
const QUEUE = 'industriallink.api';

/**
 * Event Bus — Domain giao tiếp qua sự kiện, không gọi trực tiếp nhau.
 *
 * provider=memory: dispatch in-process.
 * provider=rabbitmq: publish/consume qua RabbitMQ (local Docker); lỗi kết nối → fallback memory.
 */
@Injectable()
export class AppEventBus implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AppEventBus.name);
  private readonly handlers = new Map<DomainEventName, DomainEventHandler[]>();
  private mode: 'memory' | 'rabbitmq' = 'memory';
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly config: ConfigService<AppConfig, true>) {}

  get provider(): 'memory' | 'rabbitmq' {
    return this.mode;
  }

  subscribe(name: DomainEventName, handler: DomainEventHandler): void {
    const list = this.handlers.get(name) ?? [];
    list.push(handler);
    this.handlers.set(name, list);
  }

  publish(event: DomainEventEnvelope): void {
    this.logger.debug(`Phát sự kiện ${event.name} (eventId=${event.eventId}) via=${this.mode}`);

    if (this.mode === 'rabbitmq' && this.channel) {
      try {
        const ok = this.channel.publish(
          EXCHANGE,
          event.name,
          Buffer.from(JSON.stringify(event), 'utf8'),
          {
            contentType: 'application/json',
            persistent: true,
            messageId: event.eventId,
            correlationId: event.correlationId,
            timestamp: Date.parse(event.occurredAt) || Date.now(),
          },
        );
        if (!ok) {
          this.logger.warn(`RabbitMQ backpressure — fallback memory cho ${event.name}`);
          this.dispatchLocal(event);
        }
        return;
      } catch (err) {
        this.logger.warn(`RabbitMQ publish lỗi, fallback memory: ${String(err)}`);
        this.dispatchLocal(event);
        return;
      }
    }

    this.dispatchLocal(event);
  }

  /** Soft health: up | down | disabled(memory mode). */
  async ping(): Promise<'up' | 'down' | 'disabled'> {
    const preferred = this.config.get('eventBus', { infer: true }).provider;
    if (preferred !== 'rabbitmq') return 'disabled';
    if (this.mode !== 'rabbitmq' || !this.channel) return 'down';
    try {
      await this.channel.checkQueue(QUEUE);
      return 'up';
    } catch {
      return 'down';
    }
  }

  async onApplicationBootstrap(): Promise<void> {
    const cfg = this.config.get('eventBus', { infer: true });
    if (cfg.provider !== 'rabbitmq') {
      this.mode = 'memory';
      this.logger.log('Event Bus dùng memory (EVENT_BUS_PROVIDER=memory)');
      return;
    }

    try {
      await this.connectRabbit(cfg.rabbitmqUrl);
      this.mode = 'rabbitmq';
      this.logger.log(
        `Event Bus dùng RabbitMQ exchange=${EXCHANGE} queue=${QUEUE} bindings=${this.handlers.size}`,
      );
    } catch (err) {
      this.mode = 'memory';
      this.logger.warn(
        `Không kết nối RabbitMQ (${String(err)}) — fallback Event Bus memory`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
    } catch {
      /* ignore */
    }
    try {
      await this.connection?.close();
    } catch {
      /* ignore */
    }
    this.channel = null;
    this.connection = null;
  }

  private async connectRabbit(url: string): Promise<void> {
    const conn = await amqp.connect(url);
    const ch = await conn.createChannel();
    await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
    await ch.assertQueue(QUEUE, { durable: true });

    const keys = [...this.handlers.keys()];
    if (keys.length === 0) {
      // Bind wildcard để không mất message nếu subscribe muộn (hiếm).
      await ch.bindQueue(QUEUE, EXCHANGE, '#');
    } else {
      for (const key of keys) {
        await ch.bindQueue(QUEUE, EXCHANGE, key);
      }
    }

    await ch.prefetch(16);
    await ch.consume(QUEUE, (msg) => {
      if (!msg) return;
      void this.handleMessage(ch, msg);
    });

    conn.on('error', (err) => {
      this.logger.error(`RabbitMQ connection error: ${String(err)}`);
      this.mode = 'memory';
    });
    conn.on('close', () => {
      this.logger.warn('RabbitMQ connection closed — Event Bus chuyển memory');
      this.mode = 'memory';
      this.channel = null;
      this.connection = null;
    });

    this.connection = conn;
    this.channel = ch;
  }

  private async handleMessage(
    ch: Channel,
    msg: amqp.ConsumeMessage,
  ): Promise<void> {
    try {
      const event = JSON.parse(msg.content.toString('utf8')) as DomainEventEnvelope;
      await this.dispatchLocalAsync(event);
      ch.ack(msg);
    } catch (err) {
      this.logger.error(`Xử lý message RabbitMQ lỗi: ${String(err)}`);
      ch.nack(msg, false, false);
    }
  }

  private dispatchLocal(event: DomainEventEnvelope): void {
    void this.dispatchLocalAsync(event);
  }

  private async dispatchLocalAsync(event: DomainEventEnvelope): Promise<void> {
    const list = this.handlers.get(event.name as DomainEventName) ?? [];
    await Promise.all(
      list.map((handler) =>
        Promise.resolve(handler(event)).catch((err) => {
          this.logger.error(
            `Handler cho sự kiện ${event.name} lỗi (eventId=${event.eventId}): ${String(err)}`,
          );
        }),
      ),
    );
  }
}
