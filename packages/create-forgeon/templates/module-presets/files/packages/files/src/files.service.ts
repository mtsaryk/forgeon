import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import {
  BadRequestException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@forgeon/db-prisma';
import { FilesConfigService } from './files-config.service';
import type { FileRecordDto, FileVariantKey, StoredFileInput } from './files.types';

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

type BlobRef = {
  id: string;
  hash: string;
  size: number;
  mimeType: string;
  storageDriver: string;
  storageKey: string;
  created: boolean;
};

type PrismaLikeError = {
  code?: unknown;
};

type PreparedStoredFile = {
  buffer: Buffer;
  mimeType: string;
  size: number;
  fileName: string;
};

type PersistedVariant = {
  variantKey: FileVariantKey;
  mimeType: string;
  size: number;
  status: string;
};

@Injectable()
export class FilesService {
  private s3Client:
    | {
        send: (command: unknown) => Promise<{
          Body?: unknown;
        }>;
      }
    | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly filesConfigService: FilesConfigService,
  ) {}

  async create(input: StoredFileInput): Promise<FileRecordDto> {
    if (!this.filesConfigService.enabled) {
      throw new ServiceUnavailableException('Files module is disabled');
    }

    const preparedOriginal = await this.prepareOriginalForStorage(input);
    this.validateMimeType(preparedOriginal.mimeType);
    this.validateSize(preparedOriginal.size);

    const createdBlobIds: string[] = [];
    let recordId: string | null = null;

    try {
      const originalBlob = await this.getOrCreateBlob(preparedOriginal, true);
      if (originalBlob.created) {
        createdBlobIds.push(originalBlob.id);
      }

      const record = await this.prisma.fileRecord.create({
        data: {
          publicId: this.generatePublicId(),
          storageKey: originalBlob.storageKey,
          originalName: input.originalName,
          mimeType: preparedOriginal.mimeType,
          size: preparedOriginal.size,
          storageDriver: originalBlob.storageDriver,
          ownerType: input.ownerType ?? 'system',
          ownerId: input.ownerId ?? null,
          visibility: input.visibility ?? 'private',
          createdById: input.createdById ?? null,
        },
      });
      recordId = record.id;

      const persistedVariants: PersistedVariant[] = [
        {
          variantKey: 'original',
          mimeType: preparedOriginal.mimeType,
          size: preparedOriginal.size,
          status: 'ready',
        },
      ];
      const persistedVariantBlobIds: string[] = [originalBlob.id];

      const previewCandidate = await this.buildPreviewVariant(preparedOriginal, input);
      if (previewCandidate) {
        this.validateMimeType(previewCandidate.mimeType);
        this.validateSize(previewCandidate.size);
        const previewBlob = await this.getOrCreateBlob(previewCandidate, true);
        if (previewBlob.created) {
          createdBlobIds.push(previewBlob.id);
        }
        persistedVariants.push({
          variantKey: 'preview',
          mimeType: previewCandidate.mimeType,
          size: previewCandidate.size,
          status: 'ready',
        });
        persistedVariantBlobIds.push(previewBlob.id);
      }

      await this.prisma.fileVariant.createMany({
        data: persistedVariants.map((item, index) => ({
          fileId: record.id,
          variantKey: item.variantKey,
          blobId: persistedVariantBlobIds[index],
          mimeType: item.mimeType,
          size: item.size,
          status: item.status,
        })),
      });

      return this.getByPublicId(record.publicId);
    } catch (error) {
      if (recordId) {
        await this.prisma.fileRecord.delete({ where: { id: recordId } }).catch(() => undefined);
      }
      await this.cleanupCreatedBlobs(createdBlobIds);
      throw error;
    }
  }

  async createProbeRecord(): Promise<FileRecordDto> {
    const content = Buffer.from(`probe-${Date.now()}`);
    return this.create({
      originalName: 'health-probe.txt',
      mimeType: 'text/plain',
      size: content.byteLength,
      buffer: content,
      ownerType: 'system',
      visibility: 'private',
    });
  }

  async deleteByPublicId(publicId: string): Promise<{ deleted: boolean }> {
    const record = await this.prisma.fileRecord.findUnique({
      where: { publicId },
      include: {
        variants: {
          select: {
            blobId: true,
            blob: {
              select: {
                storageDriver: true,
                storageKey: true,
              },
            },
          },
        },
      },
    });
    if (!record) {
      throw new NotFoundException('File not found');
    }

    const blobIds = record.variants.map((variant) => variant.blobId);
    await this.prisma.fileRecord.delete({
      where: { publicId },
    });
    await this.cleanupReferencedBlobs(blobIds);

    if (record.variants.length === 0) {
      await this.deleteStoredContent(record.storageDriver, record.storageKey).catch(() => undefined);
    }

    return { deleted: true };
  }

  async getByPublicId(publicId: string): Promise<FileRecordDto> {
    const record = await this.prisma.fileRecord.findUnique({
      where: { publicId },
      include: {
        variants: {
          select: {
            variantKey: true,
          },
        },
      },
    });
    if (!record) {
      throw new NotFoundException('File not found');
    }
    return this.toDto(record);
  }

  async getOwnerUsage(ownerType: string, ownerId: string): Promise<{ filesCount: number; totalBytes: number }> {
    const aggregate = await this.prisma.fileRecord.aggregate({
      where: {
        ownerType,
        ownerId,
      },
      _count: {
        _all: true,
      },
      _sum: {
        size: true,
      },
    });

    return {
      filesCount: aggregate._count._all ?? 0,
      totalBytes: aggregate._sum.size ?? 0,
    };
  }

  async openDownload(publicId: string, variant: FileVariantKey = 'original'): Promise<{
    stream: Readable;
    mimeType: string;
    fileName: string;
  }> {
    const record = await this.prisma.fileRecord.findUnique({
      where: { publicId },
      include: {
        variants: {
          select: {
            variantKey: true,
            blob: {
              select: {
                storageDriver: true,
                storageKey: true,
              },
            },
            mimeType: true,
            size: true,
          },
        },
      },
    });
    if (!record) {
      throw new NotFoundException('File not found');
    }

    const selectedVariant =
      record.variants.find((item) => item.variantKey === variant) ??
      (variant === 'original'
        ? {
            variantKey: 'original',
            blob: {
              storageDriver: record.storageDriver,
              storageKey: record.storageKey,
            },
            mimeType: record.mimeType,
            size: record.size,
          }
        : null);

    if (!selectedVariant) {
      throw new NotFoundException('File variant not found');
    }

    switch (selectedVariant.blob.storageDriver) {
      case 'local': {
        const absolutePath = path.resolve(process.cwd(), this.resolveLocalRootDir(), selectedVariant.blob.storageKey);
        if (!fs.existsSync(absolutePath)) {
          throw new NotFoundException('File content not found');
        }
        return {
          stream: fs.createReadStream(absolutePath),
          mimeType: selectedVariant.mimeType,
          fileName: this.buildVariantFileName(record.originalName, variant, selectedVariant.mimeType),
        };
      }
      case 's3': {
        const stream = await this.openS3(selectedVariant.blob.storageKey);
        return {
          stream,
          mimeType: selectedVariant.mimeType,
          fileName: this.buildVariantFileName(record.originalName, variant, selectedVariant.mimeType),
        };
      }
      default:
        throw new ServiceUnavailableException('Unknown files storage driver');
    }
  }

  async getVariantsProbeStatus(): Promise<{
    status: 'ok';
    feature: 'files-variants';
    supportedVariants: FileVariantKey[];
    previewGenerationEnabled: boolean;
  }> {
    return {
      status: 'ok',
      feature: 'files-variants',
      supportedVariants: ['original', 'preview'],
      previewGenerationEnabled: await this.isPreviewGenerationEnabled(),
    };
  }

  private validateMimeType(mimeType: string): void {
    const allowed = this.filesConfigService.allowedMimePrefixes;
    const accepted = allowed.some((prefix) => mimeType.startsWith(prefix));
    if (!accepted) {
      throw new BadRequestException({
        message: 'Unsupported file type',
        details: {
          mimeType,
          allowedMimePrefixes: allowed,
        },
      });
    }
  }

  private validateSize(size: number): void {
    const maxSize = this.filesConfigService.maxFileSizeBytes;
    if (size > maxSize) {
      throw new BadRequestException({
        message: 'File is too large',
        details: {
          size,
          maxSize,
        },
      });
    }
  }

  private async store(buffer: Buffer, originalName: string): Promise<{ storageKey: string }> {
    const extension = path.extname(originalName).toLowerCase();
    const fileName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    switch (this.filesConfigService.storageDriver) {
      case 'local':
        return this.storeLocal(buffer, fileName);
      case 's3':
        return this.storeS3(buffer, fileName);
      default:
        throw new ServiceUnavailableException('Unknown files storage driver');
    }
  }

  private async getOrCreateBlob(input: PreparedStoredFile, dedupe: boolean): Promise<BlobRef> {
    const storageDriver = this.filesConfigService.storageDriver;
    const hash = this.computeContentHash(input.buffer);

    if (dedupe) {
      const existing = await this.findExistingBlobRef(hash, input.size, input.mimeType, storageDriver);
      if (existing) {
        return existing;
      }
    }

    const stored = await this.store(input.buffer, input.fileName);
    try {
      const created = await this.prisma.fileBlob.create({
        data: {
          hash,
          size: input.size,
          mimeType: input.mimeType,
          storageDriver,
          storageKey: stored.storageKey,
        },
      });

      return {
        id: created.id,
        hash: created.hash,
        size: created.size,
        mimeType: created.mimeType,
        storageDriver: created.storageDriver,
        storageKey: created.storageKey,
        created: true,
      };
    } catch (error) {
      if (dedupe && this.isUniqueConstraintError(error)) {
        const existing = await this.findExistingBlobRef(hash, input.size, input.mimeType, storageDriver);
        if (existing) {
          await this.deleteStoredContent(storageDriver, stored.storageKey).catch(() => undefined);
          return existing;
        }
      }

      await this.deleteStoredContent(storageDriver, stored.storageKey).catch(() => undefined);
      throw error;
    }
  }

  protected async prepareOriginalForStorage(input: StoredFileInput): Promise<PreparedStoredFile> {
    return {
      buffer: input.buffer,
      mimeType: input.mimeType,
      size: input.size,
      fileName: input.originalName,
    };
  }

  protected async buildPreviewVariant(
    _preparedOriginal: PreparedStoredFile,
    _input: StoredFileInput,
  ): Promise<PreparedStoredFile | null> {
    return null;
  }

  protected async isPreviewGenerationEnabled(): Promise<boolean> {
    return false;
  }

  private async deleteStoredContent(storageDriver: string, storageKey: string): Promise<void> {
    switch (storageDriver) {
      case 'local':
        await this.deleteLocal(storageKey);
        return;
      case 's3':
        await this.deleteS3(storageKey);
        return;
      default:
        throw new ServiceUnavailableException('Unknown files storage driver');
    }
  }

  private async storeLocal(buffer: Buffer, storageKey: string): Promise<{ storageKey: string }> {
    const rootDir = this.resolveLocalRootDir();
    const absoluteRoot = path.resolve(process.cwd(), rootDir);
    const absolutePath = path.join(absoluteRoot, storageKey);

    await fsPromises.mkdir(absoluteRoot, { recursive: true });
    await fsPromises.writeFile(absolutePath, buffer);

    return { storageKey };
  }

  private async storeS3(buffer: Buffer, storageKey: string): Promise<{ storageKey: string }> {
    const { PutObjectCommand } = await this.loadS3Module();
    const client = await this.getS3Client();
    const config = this.resolveS3Config();

    await client.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
        Body: buffer,
      }),
    );

    return { storageKey };
  }

  private async openS3(storageKey: string): Promise<Readable> {
    const { GetObjectCommand } = await this.loadS3Module();
    const client = await this.getS3Client();
    const config = this.resolveS3Config();

    const response = await client.send(
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
      }),
    );
    if (!response.Body) {
      throw new NotFoundException('File content not found');
    }

    return this.toNodeReadable(response.Body);
  }

  private async deleteS3(storageKey: string): Promise<void> {
    const { DeleteObjectCommand } = await this.loadS3Module();
    const client = await this.getS3Client();
    const config = this.resolveS3Config();
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: storageKey,
      }),
    );
  }

  private async deleteLocal(storageKey: string): Promise<void> {
    const rootDir = this.resolveLocalRootDir();
    const absoluteRoot = path.resolve(process.cwd(), rootDir);
    const absolutePath = path.join(absoluteRoot, storageKey);

    if (!fs.existsSync(absolutePath)) {
      return;
    }
    try {
      await fsPromises.unlink(absolutePath);
    } catch (error) {
      throw new InternalServerErrorException({
        message: 'Failed to delete file content',
        details: {
          storageKey,
          reason: error instanceof Error ? error.message : 'unknown',
        },
      });
    }
  }

  private resolveLocalRootDir(): string {
    const value = this.configService.get<string>('filesLocal.rootDir');
    if (!value) {
      throw new ServiceUnavailableException(
        'files-local adapter is not configured. Install/add files-local and ensure FILES_LOCAL_ROOT is set.',
      );
    }
    return value;
  }

  private resolveS3Config(): {
    providerPreset: 'minio' | 'r2' | 'aws' | 'custom';
    bucket: string;
    region: string;
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    maxAttempts: number;
  } {
    const providerPreset =
      this.configService.get<'minio' | 'r2' | 'aws' | 'custom'>('filesS3.providerPreset') ?? 'minio';
    const bucket = this.configService.get<string>('filesS3.bucket');
    const region = this.configService.get<string>('filesS3.region');
    const endpoint = this.configService.get<string>('filesS3.endpoint');
    const accessKeyId = this.configService.get<string>('filesS3.accessKeyId');
    const secretAccessKey = this.configService.get<string>('filesS3.secretAccessKey');
    const forcePathStyle = this.configService.get<boolean>('filesS3.forcePathStyle');
    const maxAttempts = this.configService.get<number>('filesS3.maxAttempts') ?? 3;

    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException(
        'files-s3 adapter is not configured. Install/add files-s3 and ensure FILES_S3_* env keys are set.',
      );
    }
    if (providerPreset !== 'aws' && !endpoint) {
      throw new ServiceUnavailableException(
        `files-s3 adapter endpoint is required for provider preset "${providerPreset}".`,
      );
    }

    return {
      providerPreset,
      bucket,
      region,
      endpoint,
      accessKeyId,
      secretAccessKey,
      forcePathStyle: forcePathStyle !== false,
      maxAttempts,
    };
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
    const config = this.resolveS3Config();
    this.s3Client = new S3Client({
      region: config.region,
      ...(config.endpoint ? { endpoint: config.endpoint } : {}),
      forcePathStyle: config.forcePathStyle,
      maxAttempts: config.maxAttempts,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
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

  private generatePublicId(): string {
    return crypto.randomUUID().replace(/-/g, '');
  }

  private computeContentHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private async cleanupCreatedBlobs(blobIds: string[]): Promise<void> {
    await this.cleanupReferencedBlobs(blobIds);
  }

  private async cleanupReferencedBlobs(blobIds: string[]): Promise<void> {
    const uniqueIds = [...new Set(blobIds.filter(Boolean))];
    for (const blobId of uniqueIds) {
      const blob = await this.prisma.fileBlob.findUnique({
        where: { id: blobId },
      });
      if (!blob) {
        continue;
      }

      const deleted = await this.prisma.fileBlob.deleteMany({
        where: {
          id: blob.id,
          variants: {
            none: {},
          },
        },
      });
      if (deleted.count === 0) {
        continue;
      }
      await this.deleteStoredContent(blob.storageDriver, blob.storageKey).catch(() => undefined);
    }
  }

  private async findExistingBlobRef(
    hash: string,
    size: number,
    mimeType: string,
    storageDriver: string,
  ): Promise<BlobRef | null> {
    const existing = await this.prisma.fileBlob.findFirst({
      where: {
        hash,
        size,
        mimeType,
        storageDriver,
      },
    });
    if (!existing) {
      return null;
    }
    return {
      id: existing.id,
      hash: existing.hash,
      size: existing.size,
      mimeType: existing.mimeType,
      storageDriver: existing.storageDriver,
      storageKey: existing.storageKey,
      created: false,
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    return (error as PrismaLikeError).code === 'P2002';
  }

  private buildVariantFileName(originalName: string, variant: FileVariantKey, mimeType: string): string {
    if (variant === 'original') {
      return originalName;
    }

    const parsed = path.parse(originalName);
    const extension = this.extensionFromMime(mimeType) ?? (parsed.ext || '');
    return `${parsed.name}-${variant}${extension}`;
  }

  private extensionFromMime(mimeType: string): string | null {
    if (mimeType === 'image/jpeg') return '.jpg';
    if (mimeType === 'image/png') return '.png';
    if (mimeType === 'image/webp') return '.webp';
    if (mimeType === 'application/pdf') return '.pdf';
    if (mimeType.startsWith('text/')) return '.txt';
    return null;
  }

  private toDto(record: {
    id: string;
    publicId: string;
    storageKey: string;
    originalName: string;
    mimeType: string;
    size: number;
    storageDriver: string;
    ownerType: string;
    ownerId: string | null;
    visibility: string;
    createdById: string | null;
    createdAt: Date;
    updatedAt: Date;
    variants?: Array<{
      variantKey: string;
    }>;
  }): FileRecordDto {
    const availableVariants = new Set<FileVariantKey>(['original']);
    for (const variant of record.variants ?? []) {
      if (variant.variantKey === 'original' || variant.variantKey === 'preview') {
        availableVariants.add(variant.variantKey);
      }
    }

    return {
      id: record.id,
      publicId: record.publicId,
      storageKey: record.storageKey,
      originalName: record.originalName,
      mimeType: record.mimeType,
      size: record.size,
      storageDriver: record.storageDriver,
      ownerType: record.ownerType,
      ownerId: record.ownerId,
      visibility: record.visibility,
      createdById: record.createdById,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      url: this.buildPublicUrl(record.publicId),
      availableVariants: [...availableVariants],
    };
  }

  private buildPublicUrl(publicId: string): string {
    const basePath = this.filesConfigService.publicBasePath.startsWith('/')
      ? this.filesConfigService.publicBasePath
      : `/${this.filesConfigService.publicBasePath}`;
    return `${basePath}/${publicId}/download`;
  }
}
