import crypto from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { FilesConfigService } from './files-config.service';
import {
  FILES_PERSISTENCE_PORT,
  FILES_STORAGE_ADAPTER,
} from './files.ports';
import type {
  FilesBlobRecord,
  FilesBlobRef,
  FilesPersistencePort,
  FilesRecordAggregate,
  FilesStorageAdapter,
} from './files.ports';
import type { FileRecordDto, FileVariantKey, StoredFileInput } from './files.types';

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
  constructor(
    @Inject(FILES_PERSISTENCE_PORT)
    private readonly persistence: FilesPersistencePort,
    @Inject(FILES_STORAGE_ADAPTER)
    private readonly storageAdapter: FilesStorageAdapter,
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

      const record = await this.persistence.createFileRecord({
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

      await this.persistence.createVariants(
        persistedVariants.map((item, index) => ({
          fileId: record.id,
          variantKey: item.variantKey,
          blobId: persistedVariantBlobIds[index],
          mimeType: item.mimeType,
          size: item.size,
          status: item.status,
        })),
      );

      return this.getByPublicId(record.publicId);
    } catch (error) {
      if (recordId) {
        await this.persistence.deleteFileRecordById(recordId).catch(() => undefined);
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
    const record = await this.persistence.findFileRecordForDelete(publicId);
    if (!record) {
      throw new NotFoundException('File not found');
    }

    const blobIds = (record.variants ?? []).map((variant) => variant.blobId);
    await this.persistence.deleteFileRecordByPublicId(publicId);
    await this.cleanupReferencedBlobs(blobIds);

    if ((record.variants ?? []).length === 0) {
      await this.deleteStoredContent(record.storageDriver, record.storageKey).catch(() => undefined);
    }

    return { deleted: true };
  }

  async getByPublicId(publicId: string): Promise<FileRecordDto> {
    const record = await this.persistence.findFileRecordWithVariantKeys(publicId);
    if (!record) {
      throw new NotFoundException('File not found');
    }
    return this.toDto(record);
  }

  async getOwnerUsage(ownerType: string, ownerId: string): Promise<{ filesCount: number; totalBytes: number }> {
    return this.persistence.countOwnerUsage(ownerType, ownerId);
  }

  async openDownload(publicId: string, variant: FileVariantKey = 'original'): Promise<{
    stream: Readable;
    mimeType: string;
    fileName: string;
  }> {
    const record = await this.persistence.findFileRecordForDownload(publicId);
    if (!record) {
      throw new NotFoundException('File not found');
    }

    const selectedVariant =
      record.variants?.find((item) => item.variantKey === variant) ??
      (variant === 'original'
        ? {
            variantKey: 'original',
            blobId: 'original',
            blob: {
              storageDriver: record.storageDriver,
              storageKey: record.storageKey,
            },
            mimeType: record.mimeType,
            size: record.size,
            status: 'ready',
          }
        : null);

    if (!selectedVariant?.blob) {
      throw new NotFoundException('File variant not found');
    }

    return {
      stream: await this.openStoredContent(selectedVariant.blob.storageDriver, selectedVariant.blob.storageKey),
      mimeType: selectedVariant.mimeType,
      fileName: this.buildVariantFileName(record.originalName, variant, selectedVariant.mimeType),
    };
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
    return this.storageAdapter.put(buffer, fileName);
  }

  private async getOrCreateBlob(input: PreparedStoredFile, dedupe: boolean): Promise<FilesBlobRef> {
    const storageDriver = this.storageAdapter.driver;
    const hash = this.computeContentHash(input.buffer);

    if (dedupe) {
      const existing = await this.findExistingBlobRef(hash, input.size, input.mimeType, storageDriver);
      if (existing) {
        return existing;
      }
    }

    const stored = await this.store(input.buffer, input.fileName);
    try {
      const created = await this.persistence.createBlob({
        hash,
        size: input.size,
        mimeType: input.mimeType,
        storageDriver,
        storageKey: stored.storageKey,
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

  private async openStoredContent(storageDriver: string, storageKey: string): Promise<Readable> {
    if (storageDriver !== this.storageAdapter.driver) {
      throw new ServiceUnavailableException(
        `File was stored with driver "${storageDriver}", but current adapter is "${this.storageAdapter.driver}".`,
      );
    }
    return this.storageAdapter.open(storageKey);
  }

  private async deleteStoredContent(storageDriver: string, storageKey: string): Promise<void> {
    if (storageDriver !== this.storageAdapter.driver) {
      throw new ServiceUnavailableException(
        `File was stored with driver "${storageDriver}", but current adapter is "${this.storageAdapter.driver}".`,
      );
    }
    await this.storageAdapter.delete(storageKey);
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
      const blob = await this.persistence.findBlobById(blobId);
      if (!blob) {
        continue;
      }

      const deleted = await this.persistence.deleteBlobIfUnreferenced(blob.id);
      if (!deleted) {
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
  ): Promise<FilesBlobRef | null> {
    const existing = await this.persistence.findBlobRef(hash, size, mimeType, storageDriver);
    if (!existing) {
      return null;
    }
    return existing;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }
    return (error as PrismaLikeError).code === 'P2002';
  }

  protected normalizeFileName(originalName: string, extension: string, suffix?: string): string {
    const parsed = path.parse(originalName);
    const safeExtension = extension.startsWith('.') ? extension : `.${extension}`;
    const base = suffix ? `${parsed.name}-${suffix}` : parsed.name;
    return `${base}${safeExtension}`;
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

  private toDto(record: FilesRecordAggregate): FileRecordDto {
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
