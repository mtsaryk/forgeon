import {
  FILES_PERSISTENCE_PORT,
  type FilesBlobCreateInput,
  type FilesBlobRef,
  type FilesPersistencePort,
  type FilesRecordAggregate,
  type FilesRecordCreateInput,
  type FilesVariantCreateInput,
} from '@forgeon/files';
import { PrismaService } from '@forgeon/db-prisma';
import { Injectable } from '@nestjs/common';

@Injectable()
export class PrismaFilesPersistenceStore implements FilesPersistencePort {
  constructor(private readonly prisma: PrismaService) {}

  async createFileRecord(data: FilesRecordCreateInput): Promise<{ id: string; publicId: string }> {
    const record = await this.prisma.fileRecord.create({ data });
    return {
      id: record.id,
      publicId: record.publicId,
    };
  }

  async deleteFileRecordById(id: string): Promise<void> {
    await this.prisma.fileRecord.delete({ where: { id } });
  }

  async deleteFileRecordByPublicId(publicId: string): Promise<void> {
    await this.prisma.fileRecord.delete({ where: { publicId } });
  }

  async findFileRecordWithVariantKeys(publicId: string): Promise<FilesRecordAggregate | null> {
    return this.prisma.fileRecord.findUnique({
      where: { publicId },
      include: {
        variants: {
          select: {
            variantKey: true,
            blobId: true,
            mimeType: true,
            size: true,
            status: true,
          },
        },
      },
    });
  }

  async findFileRecordForDelete(publicId: string): Promise<FilesRecordAggregate | null> {
    return this.prisma.fileRecord.findUnique({
      where: { publicId },
      include: {
        variants: {
          select: {
            variantKey: true,
            blobId: true,
            mimeType: true,
            size: true,
            status: true,
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
  }

  async findFileRecordForDownload(publicId: string): Promise<FilesRecordAggregate | null> {
    return this.prisma.fileRecord.findUnique({
      where: { publicId },
      include: {
        variants: {
          select: {
            variantKey: true,
            blobId: true,
            mimeType: true,
            size: true,
            status: true,
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
  }

  async countOwnerUsage(ownerType: string, ownerId: string): Promise<{ filesCount: number; totalBytes: number }> {
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

  async findBlobRef(hash: string, size: number, mimeType: string, storageDriver: string): Promise<FilesBlobRef | null> {
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

  async createBlob(data: FilesBlobCreateInput) {
    return this.prisma.fileBlob.create({ data });
  }

  async createVariants(data: FilesVariantCreateInput[]): Promise<void> {
    await this.prisma.fileVariant.createMany({ data });
  }

  async findBlobById(id: string) {
    return this.prisma.fileBlob.findUnique({
      where: { id },
    });
  }

  async deleteBlobIfUnreferenced(id: string): Promise<boolean> {
    const deleted = await this.prisma.fileBlob.deleteMany({
      where: {
        id,
        variants: {
          none: {},
        },
      },
    });
    return deleted.count > 0;
  }
}
