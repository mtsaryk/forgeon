import fs from 'node:fs';
import { promises as fsPromises } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { FilesLocalConfigService } from './files-local-config.service';

@Injectable()
export class LocalFilesStorageAdapter {
  readonly driver = 'local';

  constructor(private readonly configService: FilesLocalConfigService) {}

  async put(buffer: Buffer, storageKey: string): Promise<{ storageKey: string }> {
    const absoluteRoot = path.resolve(process.cwd(), this.configService.rootDir);
    const absolutePath = path.join(absoluteRoot, storageKey);

    await fsPromises.mkdir(absoluteRoot, { recursive: true });
    await fsPromises.writeFile(absolutePath, buffer);

    return { storageKey };
  }

  async open(storageKey: string): Promise<Readable> {
    const absoluteRoot = path.resolve(process.cwd(), this.configService.rootDir);
    const absolutePath = path.join(absoluteRoot, storageKey);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('File content not found');
    }
    return fs.createReadStream(absolutePath);
  }

  async delete(storageKey: string): Promise<void> {
    const absoluteRoot = path.resolve(process.cwd(), this.configService.rootDir);
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
}
