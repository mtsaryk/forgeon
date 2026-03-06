import { registerAs } from '@nestjs/config';
import { parseFilesS3Env } from './files-s3-env.schema';

export type FilesS3ProviderPreset = 'minio' | 'r2' | 'aws' | 'custom';

export type FilesS3ConfigValue = {
  providerPreset: FilesS3ProviderPreset;
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
  maxAttempts: number;
};

const providerDefaults: Record<
  FilesS3ProviderPreset,
  {
    region: string;
    endpoint?: string;
    forcePathStyle: boolean;
  }
> = {
  minio: {
    region: 'auto',
    endpoint: 'http://localhost:9000',
    forcePathStyle: true,
  },
  r2: {
    region: 'auto',
    forcePathStyle: false,
  },
  aws: {
    region: 'us-east-1',
    forcePathStyle: false,
  },
  custom: {
    region: 'auto',
    forcePathStyle: false,
  },
};

export const filesS3Config = registerAs('filesS3', (): FilesS3ConfigValue => {
  const env = parseFilesS3Env(process.env);
  const presetDefaults = providerDefaults[env.FILES_S3_PROVIDER_PRESET];
  const hasExplicitForcePathStyle = env.FILES_S3_FORCE_PATH_STYLE !== undefined;
  return {
    providerPreset: env.FILES_S3_PROVIDER_PRESET,
    bucket: env.FILES_S3_BUCKET,
    region: env.FILES_S3_REGION ?? presetDefaults.region,
    endpoint: env.FILES_S3_ENDPOINT ?? presetDefaults.endpoint,
    accessKeyId: env.FILES_S3_ACCESS_KEY_ID,
    secretAccessKey: env.FILES_S3_SECRET_ACCESS_KEY,
    forcePathStyle: hasExplicitForcePathStyle
      ? env.FILES_S3_FORCE_PATH_STYLE !== 'false'
      : presetDefaults.forcePathStyle,
    maxAttempts: env.FILES_S3_MAX_ATTEMPTS,
  };
});
