import { Module } from '@nestjs/common';
import { FILES_PERSISTENCE_PORT } from '@forgeon/files';
import { DbPrismaModule } from '@forgeon/db-prisma';
import { PrismaFilesPersistenceStore } from './prisma-files-persistence.store';

@Module({
  imports: [DbPrismaModule],
  providers: [
    PrismaFilesPersistenceStore,
    {
      provide: FILES_PERSISTENCE_PORT,
      useExisting: PrismaFilesPersistenceStore,
    },
  ],
  exports: [FILES_PERSISTENCE_PORT],
})
export class ForgeonFilesDbPrismaModule {}
