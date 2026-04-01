import { Readable } from 'node:stream';

export const FILES_STORAGE_ADAPTER = 'FORGEON_FILES_STORAGE_ADAPTER';

export interface FilesStorageAdapter {
  readonly driver: string;
  put(buffer: Buffer, fileName: string): Promise<{
    storageKey: string;
  }>;
  open(storageKey: string): Promise<Readable>;
  delete(storageKey: string): Promise<void>;
}
