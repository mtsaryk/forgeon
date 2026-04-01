import {
  DynamicModule,
  Module,
  ModuleMetadata,
} from '@nestjs/common';
import { DbPrismaModule } from '@forgeon/db-prisma';
import { FilesController } from './files.controller';
import { FilesConfigModule } from './files-config.module';
import { FilesService } from './files.service';
import { FilesStore } from './files.store';

export interface ForgeonFilesModuleOptions {
  imports?: ModuleMetadata['imports'];
}

@Module({})
export class ForgeonFilesModule {
  static register(options: ForgeonFilesModuleOptions = {}): DynamicModule {
    return {
      module: ForgeonFilesModule,
      imports: [FilesConfigModule, DbPrismaModule, ...(options.imports ?? [])],
      controllers: [FilesController],
      providers: [FilesStore, FilesService],
      exports: [FilesConfigModule, FilesStore, FilesService],
    };
  }
}
