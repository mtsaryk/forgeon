import { registerAs } from '@nestjs/config';
import { parseFilesQuotasEnv } from './files-quotas-env.schema';

export const FILES_QUOTAS_CONFIG_NAMESPACE = 'filesQuotas';

export interface FilesQuotasConfigValues {
  enabled: boolean;
  maxFilesPerOwner: number;
  maxBytesPerOwner: number;
}

export const filesQuotasConfig = registerAs(
  FILES_QUOTAS_CONFIG_NAMESPACE,
  (): FilesQuotasConfigValues => {
    const env = parseFilesQuotasEnv(process.env);
    return {
      enabled: env.FILES_QUOTAS_ENABLED,
      maxFilesPerOwner: env.FILES_QUOTA_MAX_FILES_PER_OWNER,
      maxBytesPerOwner: env.FILES_QUOTA_MAX_BYTES_PER_OWNER,
    };
  },
);
