import { Readable } from 'node:stream';
import { Injectable, InternalServerErrorException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { FilesS3ConfigService } from './files-s3-config.service';

type S3ModuleLike = {
  S3Client: new (config: Record<string, unknown>) => {
    send: (command: unknown) => Promise<{
      Body?: unknown;
    }>;
  };
  PutObjectCommand: new (input: Record<string, unknown>) => unknown;
  GetObjectCommand: new (input: Record<string, unknown>) => unknown;
  DeleteObjectCommand: new (input: Record<string, unknown>) => unknown;
};

@Injectable()
export class S3FilesStorageAdapter {
  readonly driver = 's3';

  private s3Client:
    | {
        send: (command: unknown) => Promise<{
          Body?: unknown;
        }>;
      }
    | null = null;

  constructor(private readonly configService: FilesS3ConfigService) {}

  async put(buffer: Buffer, storageKey: string): Promise<{ storageKey: string }> {
    const { PutObjectCommand } = await this.loadS3Module();
    const client = await this.getS3Client();

    await client.send(
      new PutObjectCommand({
        Bucket: this.configService.bucket,
        Key: storageKey,
        Body: buffer,
      }),
    );

    return { storageKey };
  }

  async open(storageKey: string): Promise<Readable> {
    const { GetObjectCommand } = await this.loadS3Module();
    const client = await this.getS3Client();

    const response = await client.send(
      new GetObjectCommand({
        Bucket: this.configService.bucket,
        Key: storageKey,
      }),
    );
    if (!response.Body) {
      throw new NotFoundException('File content not found');
    }

    return this.toNodeReadable(response.Body);
  }

  async delete(storageKey: string): Promise<void> {
    const { DeleteObjectCommand } = await this.loadS3Module();
    const client = await this.getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: this.configService.bucket,
        Key: storageKey,
      }),
    );
  }

  private async getS3Client(): Promise<{
    send: (command: unknown) => Promise<{
      Body?: unknown;
    }>;
  }> {
    if (this.s3Client) {
      return this.s3Client;
    }

    const { S3Client } = await this.loadS3Module();
    const providerPreset = this.configService.providerPreset;
    const endpoint = this.configService.endpoint;

    if (providerPreset !== 'aws' && !endpoint) {
      throw new ServiceUnavailableException(
        `files-s3 adapter endpoint is required for provider preset "${providerPreset}".`,
      );
    }

    this.s3Client = new S3Client({
      region: this.configService.region,
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle: this.configService.forcePathStyle,
      maxAttempts: this.configService.maxAttempts,
      credentials: {
        accessKeyId: this.configService.accessKeyId,
        secretAccessKey: this.configService.secretAccessKey,
      },
    });
    return this.s3Client;
  }

  private toNodeReadable(body: unknown): Readable {
    if (body instanceof Readable) {
      return body;
    }
    if (typeof body === 'string' || Buffer.isBuffer(body) || body instanceof Uint8Array) {
      return Readable.from(body);
    }
    if (
      typeof body === 'object' &&
      body !== null &&
      typeof (body as { transformToWebStream?: unknown }).transformToWebStream === 'function'
    ) {
      return Readable.fromWeb(
        (body as { transformToWebStream: () => unknown }).transformToWebStream() as never,
      );
    }
    throw new InternalServerErrorException('Unsupported S3 response body type');
  }

  private async loadS3Module(): Promise<S3ModuleLike> {
    const importModule = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<S3ModuleLike>;
    return importModule('@aws-sdk/client-s3');
  }
}
