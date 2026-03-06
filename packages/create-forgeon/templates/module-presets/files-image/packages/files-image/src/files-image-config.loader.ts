import { registerAs } from '@nestjs/config';
import { parseFilesImageEnv } from './files-image-env.schema';

export const FILES_IMAGE_CONFIG_NAMESPACE = 'filesImage';

export interface FilesImageConfigValues {
  enabled: boolean;
  stripMetadata: boolean;
  maxWidth: number;
  maxHeight: number;
  maxPixels: number;
  maxFrames: number;
  processTimeoutMs: number;
  allowedMimeTypes: string[];
}

export const filesImageConfig = registerAs(
  FILES_IMAGE_CONFIG_NAMESPACE,
  (): FilesImageConfigValues => {
    const env = parseFilesImageEnv(process.env);
    return {
      enabled: env.FILES_IMAGE_ENABLED,
      stripMetadata: env.FILES_IMAGE_STRIP_METADATA,
      maxWidth: env.FILES_IMAGE_MAX_WIDTH,
      maxHeight: env.FILES_IMAGE_MAX_HEIGHT,
      maxPixels: env.FILES_IMAGE_MAX_PIXELS,
      maxFrames: env.FILES_IMAGE_MAX_FRAMES,
      processTimeoutMs: env.FILES_IMAGE_PROCESS_TIMEOUT_MS,
      allowedMimeTypes: env.FILES_IMAGE_ALLOWED_MIME_TYPES,
    };
  },
);
