import { registerAs } from '@nestjs/config';
import { parseFilesEnv } from './files-env.schema';

export type FilesConfigValue = {
  enabled: boolean;
  storageDriver: 'local' | 's3';
  publicBasePath: string;
};

export const filesConfig = registerAs('files', (): FilesConfigValue => {
  const env = parseFilesEnv(process.env);
  return {
    enabled: env.FILES_ENABLED,
    storageDriver: env.FILES_STORAGE_DRIVER,
    publicBasePath: env.FILES_PUBLIC_BASE_PATH,
  };
});
