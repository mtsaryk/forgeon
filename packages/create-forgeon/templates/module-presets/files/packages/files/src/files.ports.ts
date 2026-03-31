import { Readable } from 'node:stream';
import type { FileVariantKey } from './files.types';

export const FILES_PERSISTENCE_PORT = 'FORGEON_FILES_PERSISTENCE_PORT';
export const FILES_STORAGE_ADAPTER = 'FORGEON_FILES_STORAGE_ADAPTER';

export type FilesBlobRecord = {
  id: string;
  hash: string;
  size: number;
  mimeType: string;
  storageDriver: string;
  storageKey: string;
};

export type FilesBlobRef = FilesBlobRecord & {
  created: boolean;
};

export type FilesRecordVariant = {
  variantKey: string;
  blobId: string;
  mimeType: string;
  size: number;
  status: string;
  blob?: {
    storageDriver: string;
    storageKey: string;
  };
};

export type FilesRecordAggregate = {
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
  variants?: FilesRecordVariant[];
};

export type FilesRecordCreateInput = {
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
};

export type FilesBlobCreateInput = {
  hash: string;
  size: number;
  mimeType: string;
  storageDriver: string;
  storageKey: string;
};

export type FilesVariantCreateInput = {
  fileId: string;
  variantKey: FileVariantKey;
  blobId: string;
  mimeType: string;
  size: number;
  status: string;
};

export interface FilesPersistencePort {
  createFileRecord(data: FilesRecordCreateInput): Promise<{
    id: string;
    publicId: string;
  }>;
  deleteFileRecordById(id: string): Promise<void>;
  deleteFileRecordByPublicId(publicId: string): Promise<void>;
  findFileRecordWithVariantKeys(publicId: string): Promise<FilesRecordAggregate | null>;
  findFileRecordForDelete(publicId: string): Promise<FilesRecordAggregate | null>;
  findFileRecordForDownload(publicId: string): Promise<FilesRecordAggregate | null>;
  countOwnerUsage(ownerType: string, ownerId: string): Promise<{
    filesCount: number;
    totalBytes: number;
  }>;
  findBlobRef(hash: string, size: number, mimeType: string, storageDriver: string): Promise<FilesBlobRef | null>;
  createBlob(data: FilesBlobCreateInput): Promise<FilesBlobRecord>;
  createVariants(data: FilesVariantCreateInput[]): Promise<void>;
  findBlobById(id: string): Promise<FilesBlobRecord | null>;
  deleteBlobIfUnreferenced(id: string): Promise<boolean>;
}

export interface FilesStorageAdapter {
  readonly driver: string;
  put(buffer: Buffer, fileName: string): Promise<{
    storageKey: string;
  }>;
  open(storageKey: string): Promise<Readable>;
  delete(storageKey: string): Promise<void>;
}
