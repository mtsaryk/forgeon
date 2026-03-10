import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';
import { FilesImageConfigService } from './files-image-config.service';
import type { SanitizeImageInput, SanitizeImageResult } from './files-image.types';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const MIME_TO_ALLOWED_EXTS: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
};

@Injectable()
export class FilesImageService {
  private readonly logger = new Logger(FilesImageService.name);

  constructor(private readonly configService: FilesImageConfigService) {}

  async sanitizeForStorage(input: SanitizeImageInput): Promise<SanitizeImageResult> {
    if (!this.configService.enabled) {
      return this.toPassthrough(input);
    }

    const declaredIsImage = input.declaredMimeType.startsWith('image/');
    const detected = await this.detectFileType(input.buffer);
    const detectedMime = detected?.mime ?? null;
    const detectedIsImage = Boolean(detectedMime?.startsWith('image/'));

    if (declaredIsImage !== detectedIsImage) {
      this.securityWarn('files.image.mime_mismatch', 'FILES_IMAGE_MIME_MISMATCH', input, {
        declaredMimeType: input.declaredMimeType,
        detectedMimeType: detectedMime,
      });
      this.reject('Declared MIME type does not match actual file content', 'FILES_IMAGE_MIME_MISMATCH', {
        declaredMimeType: input.declaredMimeType,
        detectedMimeType: detectedMime,
      });
    }

    if (!declaredIsImage && !detectedIsImage) {
      return this.toPassthrough(input);
    }

    if (!detectedMime) {
      this.securityWarn('files.image.mime_undetected', 'FILES_IMAGE_UNDETECTED_TYPE', input, {
        declaredMimeType: input.declaredMimeType,
      });
      this.reject('Unable to detect image file type from content', 'FILES_IMAGE_UNDETECTED_TYPE');
    }

    const allowedMimeTypes = this.configService.allowedMimeTypes;
    if (!allowedMimeTypes.includes(detectedMime)) {
      this.securityWarn('files.image.mime_not_allowed', 'FILES_IMAGE_INVALID_TYPE', input, {
        declaredMimeType: input.declaredMimeType,
        detectedMimeType: detectedMime,
        allowedMimeTypes,
      });
      this.reject('Image MIME type is not allowed', 'FILES_IMAGE_INVALID_TYPE', {
        declaredMimeType: input.declaredMimeType,
        detectedMimeType: detectedMime,
        allowedMimeTypes,
      });
    }

    if (declaredIsImage && input.declaredMimeType !== detectedMime) {
      this.securityWarn('files.image.declared_vs_detected_mismatch', 'FILES_IMAGE_MIME_MISMATCH', input, {
        declaredMimeType: input.declaredMimeType,
        detectedMimeType: detectedMime,
      });
      this.reject('Declared image MIME type does not match content', 'FILES_IMAGE_MIME_MISMATCH', {
        declaredMimeType: input.declaredMimeType,
        detectedMimeType: detectedMime,
      });
    }

    const declaredExtension = this.extractExtension(input.originalName);
    if (declaredExtension) {
      const allowedExtensions = MIME_TO_ALLOWED_EXTS[detectedMime] ?? [];
      if (!allowedExtensions.includes(declaredExtension)) {
        this.securityWarn('files.image.extension_mismatch', 'FILES_IMAGE_EXTENSION_MISMATCH', input, {
          declaredExtension,
          detectedMimeType: detectedMime,
          allowedExtensions,
        });
        this.reject('File extension does not match detected image type', 'FILES_IMAGE_EXTENSION_MISMATCH', {
          declaredExtension,
          detectedMimeType: detectedMime,
          allowedExtensions,
        });
      }
    }

    await this.validateImageShape(input.buffer, detectedMime, input);
    const reencoded = await this.reencode(input.buffer, detectedMime, this.configService.stripMetadata);
    return {
      buffer: reencoded.buffer,
      mimeType: reencoded.mimeType,
      extension: reencoded.extension,
      transformed: true,
      detectedMimeType: detectedMime,
    };
  }

  async buildPreviewVariant(
    input: SanitizeImageInput,
  ): Promise<{
    buffer: Buffer;
    mimeType: string;
    extension: string;
  } | null> {
    if (!this.configService.enabled) {
      return null;
    }

    if (!input.declaredMimeType?.startsWith('image/')) {
      return null;
    }

    const previewMaxWidth = Math.min(this.configService.maxWidth, 1024);
    const previewMaxHeight = Math.min(this.configService.maxHeight, 1024);

    const detected = await this.detectFileType(input.buffer);
    const detectedMime = detected?.mime ?? null;
    if (!detectedMime || !detectedMime.startsWith('image/')) {
      return null;
    }

    const reencoded = await this.reencode(input.buffer, detectedMime, this.configService.stripMetadata, {
      width: previewMaxWidth,
      height: previewMaxHeight,
    });

    return {
      buffer: reencoded.buffer,
      mimeType: reencoded.mimeType,
      extension: reencoded.extension,
    };
  }

  isPreviewEnabled(): boolean {
    return this.configService.enabled;
  }

  async getProbeStatus(): Promise<
    | {
        status: 'ok';
        feature: 'files-image';
        stripMetadata: boolean;
        maxWidth: number;
        maxHeight: number;
        maxPixels: number;
        maxFrames: number;
        inputBytes: number;
        outputBytes: number;
        outputMimeType: string;
        transformed: boolean;
      }
    | {
        status: 'error';
        feature: 'files-image';
        stripMetadata: boolean;
        maxWidth: number;
        maxHeight: number;
        maxPixels: number;
        maxFrames: number;
        errorCode: string;
        errorMessage: string;
      }
  > {
    try {
      const sample = await sharp({
        create: {
          width: 4,
          height: 4,
          channels: 3,
          background: { r: 120, g: 80, b: 40 },
        },
      })
        .jpeg({ quality: 90 })
        .withMetadata()
        .toBuffer();

      const result = await this.sanitizeForStorage({
        buffer: sample,
        declaredMimeType: 'image/jpeg',
        originalName: 'probe.jpg',
      });

      return {
        status: 'ok',
        feature: 'files-image',
        stripMetadata: this.configService.stripMetadata,
        maxWidth: this.configService.maxWidth,
        maxHeight: this.configService.maxHeight,
        maxPixels: this.configService.maxPixels,
        maxFrames: this.configService.maxFrames,
        inputBytes: sample.byteLength,
        outputBytes: result.buffer.byteLength,
        outputMimeType: result.mimeType,
        transformed: result.transformed,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown files-image probe error';
      this.logger.error(
        JSON.stringify({
          event: 'files.image.probe_failed',
          errorMessage,
        }),
      );

      return {
        status: 'error',
        feature: 'files-image',
        stripMetadata: this.configService.stripMetadata,
        maxWidth: this.configService.maxWidth,
        maxHeight: this.configService.maxHeight,
        maxPixels: this.configService.maxPixels,
        maxFrames: this.configService.maxFrames,
        errorCode: 'FILES_IMAGE_PROBE_FAILED',
        errorMessage,
      };
    }
  }

  private async detectFileType(buffer: Buffer): Promise<{ mime: string; ext: string } | null> {
    const { fileTypeFromBuffer } = await import('file-type');
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected) {
      return null;
    }
    return {
      mime: detected.mime,
      ext: detected.ext,
    };
  }

  private async reencode(
    buffer: Buffer,
    detectedMimeType: string,
    stripMetadata: boolean,
    resizeOptions?: {
      width: number;
      height: number;
    },
  ): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
    const pipeline = sharp(buffer, {
      failOn: 'error',
      limitInputPixels: this.configService.maxPixels,
      animated: true,
    }).rotate();
    const resizedPipeline =
      resizeOptions && resizeOptions.width > 0 && resizeOptions.height > 0
        ? pipeline.resize({
            width: resizeOptions.width,
            height: resizeOptions.height,
            fit: 'inside',
            withoutEnlargement: true,
          })
        : pipeline;
    const withMetadataPipeline = stripMetadata ? resizedPipeline : resizedPipeline.withMetadata();

    switch (detectedMimeType) {
      case 'image/jpeg':
        return {
          buffer: await this.withTimeout(
            withMetadataPipeline.jpeg({ quality: 85, mozjpeg: true }).toBuffer(),
            this.configService.processTimeoutMs,
            'FILES_IMAGE_PROCESS_TIMEOUT',
          ),
          mimeType: 'image/jpeg',
          extension: '.jpg',
        };
      case 'image/png':
        return {
          buffer: await this.withTimeout(
            withMetadataPipeline.png({ compressionLevel: 9 }).toBuffer(),
            this.configService.processTimeoutMs,
            'FILES_IMAGE_PROCESS_TIMEOUT',
          ),
          mimeType: 'image/png',
          extension: '.png',
        };
      case 'image/webp':
        return {
          buffer: await this.withTimeout(
            withMetadataPipeline.webp({ quality: 85 }).toBuffer(),
            this.configService.processTimeoutMs,
            'FILES_IMAGE_PROCESS_TIMEOUT',
          ),
          mimeType: 'image/webp',
          extension: '.webp',
        };
      default:
        this.reject('Image MIME type is not supported for re-encode', 'FILES_IMAGE_UNSUPPORTED_MIME', {
          detectedMimeType,
        });
    }
  }

  private async validateImageShape(
    buffer: Buffer,
    detectedMimeType: string,
    input: SanitizeImageInput,
  ): Promise<void> {
    const metadata = await this.withTimeout(
      sharp(buffer, {
        failOn: 'error',
        limitInputPixels: this.configService.maxPixels,
        animated: true,
      }).metadata(),
      this.configService.processTimeoutMs,
      'FILES_IMAGE_PROCESS_TIMEOUT',
    );

    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    const frames = metadata.pages ?? 1;
    const pixels = width * height;

    if (width <= 0 || height <= 0) {
      this.securityWarn('files.image.invalid_dimensions', 'FILES_IMAGE_INVALID_DIMENSIONS', input, {
        detectedMimeType,
        width,
        height,
      });
      this.reject('Image dimensions are invalid', 'FILES_IMAGE_INVALID_DIMENSIONS', {
        detectedMimeType,
        width,
        height,
      });
    }

    if (width > this.configService.maxWidth || height > this.configService.maxHeight) {
      this.securityWarn('files.image.dimensions_exceeded', 'FILES_IMAGE_DIMENSIONS_EXCEEDED', input, {
        detectedMimeType,
        width,
        height,
        maxWidth: this.configService.maxWidth,
        maxHeight: this.configService.maxHeight,
      });
      this.reject('Image dimensions exceed configured limits', 'FILES_IMAGE_DIMENSIONS_EXCEEDED', {
        detectedMimeType,
        width,
        height,
        maxWidth: this.configService.maxWidth,
        maxHeight: this.configService.maxHeight,
      });
    }

    if (pixels > this.configService.maxPixels) {
      this.securityWarn('files.image.pixel_limit_exceeded', 'FILES_IMAGE_TOO_MANY_PIXELS', input, {
        detectedMimeType,
        pixels,
        maxPixels: this.configService.maxPixels,
      });
      this.reject('Image pixel count exceeds configured limits', 'FILES_IMAGE_TOO_MANY_PIXELS', {
        detectedMimeType,
        pixels,
        maxPixels: this.configService.maxPixels,
      });
    }

    if (frames > this.configService.maxFrames) {
      this.securityWarn('files.image.frames_limit_exceeded', 'FILES_IMAGE_TOO_MANY_FRAMES', input, {
        detectedMimeType,
        frames,
        maxFrames: this.configService.maxFrames,
      });
      this.reject('Image frame count exceeds configured limits', 'FILES_IMAGE_TOO_MANY_FRAMES', {
        detectedMimeType,
        frames,
        maxFrames: this.configService.maxFrames,
      });
    }
  }

  private toPassthrough(input: SanitizeImageInput): SanitizeImageResult {
    return {
      buffer: input.buffer,
      mimeType: input.declaredMimeType,
      extension: MIME_TO_EXT[input.declaredMimeType] ?? '',
      transformed: false,
      detectedMimeType: null,
    };
  }

  private extractExtension(fileName: string): string | null {
    const lastDot = fileName.lastIndexOf('.');
    if (lastDot < 0 || lastDot === fileName.length - 1) {
      return null;
    }
    return fileName.slice(lastDot).toLowerCase();
  }

  private reject(message: string, code: string, details?: Record<string, unknown>): never {
    throw new BadRequestException({
      message,
      details: {
        code,
        ...(details ?? {}),
      },
    });
  }

  private securityWarn(
    event: string,
    code: string,
    input: SanitizeImageInput,
    details?: Record<string, unknown>,
  ): void {
    this.logger.warn(
      JSON.stringify({
        event,
        code,
        requestId: input.auditContext?.requestId ?? null,
        ip: input.auditContext?.ip ?? null,
        userId: input.auditContext?.userId ?? null,
        originalName: input.originalName,
        declaredMimeType: input.declaredMimeType,
        ...(details ?? {}),
      }),
    );
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutCode: string): Promise<T> {
    let timeoutHandle: NodeJS.Timeout | null = null;
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(
              new BadRequestException({
                message: 'Image processing timeout exceeded',
                details: {
                  code: timeoutCode,
                  timeoutMs,
                },
              }),
            );
          }, timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}
