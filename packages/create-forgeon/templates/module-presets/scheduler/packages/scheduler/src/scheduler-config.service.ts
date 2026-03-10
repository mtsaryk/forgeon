import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SCHEDULER_CONFIG_NAMESPACE,
  SchedulerConfigValues,
} from './scheduler-config.loader';

@Injectable()
export class SchedulerConfigService {
  constructor(private readonly configService: ConfigService) {}

  get enabled(): SchedulerConfigValues['enabled'] {
    return this.configService.getOrThrow<SchedulerConfigValues['enabled']>(
      `${SCHEDULER_CONFIG_NAMESPACE}.enabled`,
    );
  }

  get timezone(): SchedulerConfigValues['timezone'] {
    return this.configService.getOrThrow<SchedulerConfigValues['timezone']>(
      `${SCHEDULER_CONFIG_NAMESPACE}.timezone`,
    );
  }

  get heartbeatCron(): SchedulerConfigValues['heartbeatCron'] {
    return this.configService.getOrThrow<SchedulerConfigValues['heartbeatCron']>(
      `${SCHEDULER_CONFIG_NAMESPACE}.heartbeatCron`,
    );
  }
}
