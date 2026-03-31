import {
  DynamicModule,
  Injectable,
  Module,
  ModuleMetadata,
  Provider,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  FilesBlobCreateInput,
  FilesPersistencePort,
  FilesRecordCreateInput,
  FilesStorageAdapter,
  FilesVariantCreateInput,
} from './files.ports';
import { FILES_PERSISTENCE_PORT, FILES_STORAGE_ADAPTER } from './files.ports';
import { FilesController } from './files.controller';
import { FilesConfigModule } from './files-config.module';
import { FilesService } from './files.service';

export interface ForgeonFilesModuleOptions {
  imports?: ModuleMetadata['imports'];
  persistenceProvider?: Provider;
  storageAdapterProvider?: Provider;
}

@Injectable()
class MissingFilesPersistencePort implements FilesPersistencePort {
  private unconfigured(): never {
    throw new ServiceUnavailableException(
      'Files persistence provider is not configured. Install/add a db-adapter provider and wire FILES_PERSISTENCE_PORT.',
    );
  }

  async createFileRecord(_data: FilesRecordCreateInput): Promise<{ id: string; publicId: string }> {
    return this.unconfigured();
  }

  async deleteFileRecordById(_id: string): Promise<void> {
    return this.unconfigured();
  }

  async deleteFileRecordByPublicId(_publicId: string): Promise<void> {
    return this.unconfigured();
  }

  async findFileRecordWithVariantKeys(_publicId: string) {
    return this.unconfigured();
  }

  async findFileRecordForDelete(_publicId: string) {
    return this.unconfigured();
  }

  async findFileRecordForDownload(_publicId: string) {
    return this.unconfigured();
  }

  async countOwnerUsage(_ownerType: string, _ownerId: string) {
    return this.unconfigured();
  }

  async findBlobRef(_hash: string, _size: number, _mimeType: string, _storageDriver: string) {
    return this.unconfigured();
  }

  async createBlob(_data: FilesBlobCreateInput) {
    return this.unconfigured();
  }

  async createVariants(_data: FilesVariantCreateInput[]): Promise<void> {
    return this.unconfigured();
  }

  async findBlobById(_id: string) {
    return this.unconfigured();
  }

  async deleteBlobIfUnreferenced(_id: string) {
    return this.unconfigured();
  }
}

@Injectable()
class MissingFilesStorageAdapter implements FilesStorageAdapter {
  readonly driver = 'unconfigured';

  private unconfigured(): never {
    throw new ServiceUnavailableException(
      'Files storage adapter is not configured. Install/add a files-storage-adapter provider and wire FILES_STORAGE_ADAPTER.',
    );
  }

  async put(_buffer: Buffer, _fileName: string): Promise<{ storageKey: string }> {
    return this.unconfigured();
  }

  async open(_storageKey: string) {
    return this.unconfigured();
  }

  async delete(_storageKey: string): Promise<void> {
    return this.unconfigured();
  }
}

@Module({
  imports: [FilesConfigModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesConfigModule, FilesService],
})
export class ForgeonFilesModule {
  static register(options: ForgeonFilesModuleOptions = {}): DynamicModule {
    const persistenceProvider =
      options.persistenceProvider ??
      ({
        provide: FILES_PERSISTENCE_PORT,
        useClass: MissingFilesPersistencePort,
      } satisfies Provider);

    const storageAdapterProvider =
      options.storageAdapterProvider ??
      ({
        provide: FILES_STORAGE_ADAPTER,
        useClass: MissingFilesStorageAdapter,
      } satisfies Provider);

    return {
      module: ForgeonFilesModule,
      imports: [...(options.imports ?? [])],
      providers: [persistenceProvider, storageAdapterProvider],
      exports: [FILES_PERSISTENCE_PORT, FILES_STORAGE_ADAPTER],
    };
  }
}
