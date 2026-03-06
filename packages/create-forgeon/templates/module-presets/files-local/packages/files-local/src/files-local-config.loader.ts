import { registerAs } from '@nestjs/config';
import { parseFilesLocalEnv } from './files-local-env.schema';

export type FilesLocalConfigValue = {
  rootDir: string;
};

export const filesLocalConfig = registerAs('filesLocal', (): FilesLocalConfigValue => {
  const env = parseFilesLocalEnv(process.env);
  return {
    rootDir: env.FILES_LOCAL_ROOT,
  };
});
