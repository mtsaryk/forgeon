import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { QueueService } from '@forgeon/queue';
import { CronJob } from 'cron';
import { SchedulerConfigService } from './scheduler-config.service';

const FORGEON_SCHEDULER_CRON_ID = 'forgeon.scheduler.heartbeat';
const FORGEON_SCHEDULER_HEARTBEAT_JOB = 'scheduler.heartbeat';

@Injectable()
export class ForgeonSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ForgeonSchedulerService.name);

  private initializedAt: string | null = null;
  private lastTickAt: string | null = null;
  private lastEnqueue: { queued: boolean; id: string | null } | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly schedulerConfig: SchedulerConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly queueService: QueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.initializedAt = new Date().toISOString();

    if (!this.schedulerConfig.enabled) {
      return;
    }

    this.registerHeartbeatJob();
    await this.runHeartbeat('bootstrap');
  }

  onModuleDestroy(): void {
    try {
      const job = this.schedulerRegistry.getCronJob(FORGEON_SCHEDULER_CRON_ID);
      job.stop();
      this.schedulerRegistry.deleteCronJob(FORGEON_SCHEDULER_CRON_ID);
    } catch {
      // Job may not exist when the module is disabled or partially initialized.
    }
  }

  async getProbeStatus(): Promise<Record<string, unknown>> {
    const enabled = this.schedulerConfig.enabled;
    const heartbeatRegistered = this.isHeartbeatRegistered();
    const status = !enabled || (heartbeatRegistered && this.lastError == null) ? 'ok' : 'error';

    return {
      status,
      feature: 'scheduler',
      enabled,
      timezone: this.schedulerConfig.timezone,
      heartbeatCron: this.schedulerConfig.heartbeatCron,
      heartbeatRegistered,
      initializedAt: this.initializedAt,
      lastTickAt: this.lastTickAt,
      lastEnqueue: this.lastEnqueue,
      lastError: this.lastError,
    };
  }

  private registerHeartbeatJob(): void {
    if (this.isHeartbeatRegistered()) {
      return;
    }

    const job = new CronJob(
      this.schedulerConfig.heartbeatCron,
      () => {
        void this.runHeartbeat('cron');
      },
      null,
      false,
      this.schedulerConfig.timezone,
    );

    this.schedulerRegistry.addCronJob(FORGEON_SCHEDULER_CRON_ID, job);
    job.start();
  }

  private isHeartbeatRegistered(): boolean {
    try {
      this.schedulerRegistry.getCronJob(FORGEON_SCHEDULER_CRON_ID);
      return true;
    } catch {
      return false;
    }
  }

  private async runHeartbeat(source: 'bootstrap' | 'cron'): Promise<void> {
    this.lastTickAt = new Date().toISOString();

    try {
      this.lastEnqueue = await this.queueService.enqueue(
        FORGEON_SCHEDULER_HEARTBEAT_JOB,
        {
          source,
          scheduledAt: this.lastTickAt,
        },
        {
          jobId: FORGEON_SCHEDULER_HEARTBEAT_JOB,
          removeOnComplete: 1,
          removeOnFail: 20,
        },
      );
      this.lastError = null;
    } catch (error) {
      this.lastEnqueue = { queued: false, id: null };
      this.lastError =
        error instanceof Error ? error.message : 'Scheduler heartbeat enqueue failed';
      this.logger.error(
        JSON.stringify({
          event: 'scheduler.heartbeat.enqueue_failed',
          message: this.lastError,
        }),
      );
    }
  }
}

