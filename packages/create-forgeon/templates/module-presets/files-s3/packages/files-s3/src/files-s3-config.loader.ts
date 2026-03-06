import { registerAs } from '@nestjs/config';
import { parseFilesS3Env } from './files-s3-env.schema';

export type FilesS3ConfigValue = {
  bucket: string;
  region: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle: boolean;
};

export const filesS3Config = registerAs('filesS3', (): FilesS3ConfigValue => {
  const env = parseFilesS3Env(process.env);
  return {
    bucket: env.FILES_S3_BUCKET,
    region: env.FILES_S3_REGION,
    endpoint: env.FILES_S3_ENDPOINT,
    accessKeyId: env.FILES_S3_ACCESS_KEY_ID,
    secretAccessKey: env.FILES_S3_SECRET_ACCESS_KEY,
    forcePathStyle: env.FILES_S3_FORCE_PATH_STYLE,
  };
});
