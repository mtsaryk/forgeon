import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { JobsOptions } from 'bullmq';
import { Queue } from 'bullmq';
import { QueueConfigService } from './queue-config.service';

export const FORGEON_DEFAULT_QUEUE = 'forgeon.default';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private queue: Queue | null = null;

  constructor(private readonly queueConfig: QueueConfigService) {}

  async enqueue(
    name: string,
    data: Record<string, unknown>,
    options: JobsOptions = {},
  ): Promise<{ queued: boolean; id: string | null }> {
    if (!this.queueConfig.enabled) {
      return { queued: false, id: null };
    }

    const job = await this.getQueue().add(name, data, {
      attempts: this.queueConfig.defaultAttempts,
      backoff: {
        type: 'fixed',
        delay: this.queueConfig.defaultBackoffMs,
      },
      ...options,
    });

    return {
      queued: true,
      id: job.id == null ? null : String(job.id),
    };
  }

  async getProbeStatus(): Promise<Record<string, unknown>> {
    if (!this.queueConfig.enabled) {
      return {
        status: 'ok',
        feature: 'queue',
        enabled: false,
      };
    }

    try {
      const queue = this.getQueue();
      const client = await queue.client;
      const ping = await client.ping();
      return {
        status: 'ok',
        feature: 'queue',
        enabled: true,
        queueName: FORGEON_DEFAULT_QUEUE,
        prefix: this.queueConfig.prefix,
        redis: ping,
      };
    } catch (error) {
      return {
        status: 'error',
        feature: 'queue',
        enabled: true,
        queueName: FORGEON_DEFAULT_QUEUE,
        message: error instanceof Error ? error.message : 'Queue probe failed',
      };
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.queue) {
      return;
    }

    await this.queue.close();
    this.queue = null;
  }

  private getQueue(): Queue {
    if (!this.queue) {
      this.queue = new Queue(FORGEON_DEFAULT_QUEUE, {
        prefix: this.queueConfig.prefix,
        connection: this.queueConfig.connectionOptions,
      });
    }
    return this.queue;
  }
}
